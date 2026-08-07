
How I got Qwen3-4B running fully GPU-accelerated on a ThinkPad E14 with integrated graphics, Docker, and Ollama.

Popular option is  local LLMs needs an NVIDIA card or Apple M series. But it is possible to run the smaller models with CPU or iGPU. My laptop  ThinkPad with an Intel Core Ultra 7 255H  has no discrete GPU at all. What it does have is Intel Arc integrated graphics, and as it turns out, that's enough.

**What we'll end up with:** Qwen3-4B-Instruct-2507 running locally inside Docker, with `ollama ps` reporting `100% GPU` on integrated graphics.


## The hardware (and what actually matters)

The Core Ultra 7 255H is marketed as an "AI PC" chip. It has three compute engines:

- **16 CPU cores** — what Ollama uses by default
- **Intel Arc 140T integrated GPU** — a real GPU, sharing system RAM instead of having its own VRAM
- **An NPU** — the marketing headline, and completely useless here. Ollama and llama.cpp cannot use it. Ignore it.


The interesting engine is the iGPU. Ollama recently gained a Vulkan backend, which means Intel and AMD graphics can finally accelerate inference (used to require NVIDIA CUDA previously). You'll want a reasonable amount of RAM since the iGPU borrows from it. 

Why memory bandwidth is the bottleneck: for every token generated, the entire set of active model weights must be streamed from RAM to the compute engine. Token generation is almost purely memory-bound, the GPU/CPU spends most of its time waiting for weights to arrive, not computing. So tokens/sec ≈ bandwidth ÷ model size (roughly).

| Chip / Setup                      | Bus width | Memory bandwidth (theoretical) |
| --------------------------------- | --------- | ------------------------------ |
|  Core Ultra 7 255H w/ DDR5-5600   | 128-bit   | ~90 GB/s                       |
| Core Ultra 7 255H w/ LPDDR5X-8400 | 128-bit   | ~134 GB/s                      |
| Core Ultra 7 255H w/ DDR5-6400    | 128-bit   | ~102 GB/s                      |
| Apple M4 (base)                   | 128-bit   | 120 GB/s                       |
| Apple M4 Pro                      | 256-bit   | 273 GB/s                       |
| Apple M4 Max                      | 512-bit   | up to 546 GB/s                 |

For inference speed, roughly, 
tokens/sec ≈ effective bandwidth ÷ model size in GB:

- **7–8B model at Q4 (~4.5 GB)**: ~15–18 tokens/sec — perfectly usable
- **14B at Q4 (~8.5 GB)**: ~8–10 tokens/sec — okay
- **32B at Q4 (~19 GB)**: ~3–4 tokens/sec — sluggish but it fits



## Step 1: Install Docker

Install docker from official docker repository.


## Step 2: Check your GPU device exists

```
ls -l /dev/dri
```

You want to see `renderD128`, that's the GPU's compute interface, and it's what we'll hand to the container:

```
crw-rw----+ 1 root render 226, 128 Aug  6 12:38 renderD128
```

## Step 3: Run Ollama with the iGPU

```
docker run -d \
  --name ollama \
  --device /dev/dri \
  -e OLLAMA_VULKAN=1 \
  -e OLLAMA_IGPU_ENABLE=1 \
  -p 127.0.0.1:11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama
```

What each argument does:
- `--device /dev/dri` — passes the GPU device into the container
- `OLLAMA_VULKAN=1` — enables the Vulkan backend
- `OLLAMA_IGPU_ENABLE=1` — the crucial one. Ollama **detects integrated GPUs but skips them by default**. Without this flag you get a log line saying `dropping integrated GPU` and silent fallback to CPU. This flag was the difference between CPU and GPU on my machine.
- `-p 127.0.0.1:11434:11434` — binds the API to localhost only. Ollama has no default authentication.
- `-v ollama:/root/.ollama` — a named volume so downloaded models survive container recreation

Verify the GPU was picked up:
```
docker logs ollama 2>&1 | grep -i "inference compute"
```

You should see a Vulkan device listed, mine shows `Intel(R) Graphics (ARL)` for Arrow Lake.


## Alternative Step 3 - If you are running on CPU

```
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama
```


## Step 4: Pull and run the model

Qwen3-4B-Instruct-2507 is published on Ollama with explicit quantization tags:

| Part         | Value        | What it means                                                                                                                                           |     |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Family       | **Qwen3**    | The model family and generation — Alibaba's third major Qwen release                                                                                    |     |
| Size         | **4B**       | 4 billion parameters — the size of the model. Bigger = smarter but slower and heavier on RAM                                                            |     |
| Tuning       | **Instruct** | Fine-tuned to follow instructions and chat. (Alternatives: *Base* = raw text completion, not conversational; *Thinking* = shows step-by-step reasoning) |     |
| Version      | **2507**     | Release datestamp — year/month, so July 2025                                                                                                            |     |
| Quantization | **Q4**       | 4-bit quantization — weights compressed to 4 bits each, shrinking size and speeding up inference at a small quality cost                                |     |
| Quant method | **K_M**      | "K-quant, Medium" — a specific quantization scheme. The medium variant balances quality vs. size well                                                   |     |


```
docker exec -it ollama ollama pull qwen3:4b-instruct-2507-q4_K_M
docker exec -it ollama ollama run qwen3:4b-instruct-2507-q4_K_M
```

## Step 5: Check model is available 

```
docker exec ollama ollama ps
```

```
NAME                             SIZE      PROCESSOR    CONTEXT
qwen3:4b-instruct-2507-q4_K_M    3.2 GB    100% GPU     4096
```


### Measure tokens/sec

```
docker exec -it ollama ollama run --verbose qwen3:4b-instruct-2507-q4_K_M "Write 200 words about coffee."
```

```
total duration:       20.246114022s
load duration:        137.110009ms
prompt eval count:    17 token(s)
prompt eval duration: 281.863ms
prompt eval rate:     60.31 tokens/s
eval count:           260 token(s)
eval duration:        19.82166s
eval rate:            13.12 tokens/s
```

A shared-memory iGPU is not a magic speed multiplier. The CPU and GPU draw from the same RAM bandwidth, and token generation on small models is bandwidth-bound, so raw generation speed may be similar to CPU. The clearer wins are **prompt processing** (feeding it long documents gets noticeably faster) and offloading work from CPU cores.

## Useful tweaks

**Context window.** The default is 4,096 tokens. When it fills, the oldest turns get silently dropped. The model supports up to 256K;  We can raise the default with following argument in docker run.

```
-e OLLAMA_CONTEXT_LENGTH=32768
```

A 4B model won't replace the frontier models, but it runs entirely on your machine, works offline, costs nothing per token, and never sends your data anywhere. For summarization, drafting, and quick questions, that's a genuinely useful tool living on a mid-range laptop.