

I got OpenClaw running against a local Ollama model on a Core Ultra 7 255H with 32GB RAM and no discrete GPU. It went from _freezing the laptop on the word "Hi"_ to an 80-second cold start and 20-second follow-ups. Here are the measurements, the dead ends, and the four config changes that actually mattered.

---

## The setup

- **Laptop** (Intel Core Ultra 7 255H, Arc 140T iGPU, 32GB RAM): runs Ollama in Docker, serving on the LAN.
- **Proxmox VM** (Ubuntu 24.04, 4GB RAM): runs OpenClaw, pointed at the laptop's Ollama endpoint.

The split is deliberate, the VM handles browser rendering and orchestration, the laptop does inference.

## Set your expectations before you start

OpenClaw's own documentation suggests aiming for two maxed-out Mac Studios or an equivalent GPU rig — roughly $30k — for a comfortable agent loop, and notes that a single 24GB GPU only handles lighter prompts at higher latency.

There's a GitHub issue from someone on a **Mac Studio M3 Ultra with 96GB unified RAM** reporting that background jobs take 2–5 minutes per run. Their machine has perhaps 6–8× my memory bandwidth.

So if you're on an integrated-GPU laptop: this will work, but it will not feel like a cloud model. Knowing that upfront saves a lot of chasing phantom misconfigurations.

## Why "Hello" costs thousands of tokens

Agent frameworks don't send your message. They send your message wrapped in a system prompt containing tool schemas, workspace state, skill descriptions, and memory context. In my case the default profile was pushing roughly **16,000 tokens** on every single request.

That's the whole problem in one sentence. Everything below is either reducing that number or making the hardware chew through it faster.

---

## Benchmarking, properly

Stop guessing and measure. Ollama reports timings per request:

```bash
for T in 6 8 14 16; do
  echo "=== threads: $T ==="
  curl -s http://<HOST>:11434/api/generate -d "{
    \"model\": \"llama3.2:3b\",
    \"prompt\": \"Write two sentences about the sea.\",
    \"stream\": false,
    \"options\": {\"num_thread\": $T, \"num_predict\": 128}
  }" | jq '{
    prefill: (.prompt_eval_count / (.prompt_eval_duration / 1e9)),
    gen: (.eval_count / (.eval_duration / 1e9))
  }'
done
```

Two numbers matter and they behave differently:

- **Prefill** (prompt eval) — compute-bound, benefits from the GPU. Dominates your cold start.
- **Generation** (eval) — memory-bandwidth-bound, saturates early. Dominates how long replies take.

### Results: CPU only

|Threads|Prefill (tok/s)|Generation (tok/s)|
|--:|--:|--:|
|6|55.3|19.9|
|8|69.6|**21.7**|
|14|64.4|14.8|
|16|14.0|0.46|

### Results: with iGPU

|Threads|Prefill (tok/s)|Generation (tok/s)|
|--:|--:|--:|
|6|44.1|14.9|
|8|154.4|14.6|
|14|157.3|15.2|
|16|**167.2**|15.2|

Prefill went up 2.4×. Generation went **down** ~30%. For agent workloads that's the right trade — the cold start is the painful part.

---

## Four findings worth stealing

### 1. Never set `num_thread` equal to your core count

Look at that 16-thread row: **0.46 tok/s**. A 50× collapse.

llama.cpp uses spin-wait barriers between worker threads. At `num_thread` = `nproc`, the compute threads leave zero headroom for the server's own threads, the container runtime, and kernel work. Every barrier becomes a scheduler preemption.

Leave headroom. On a 16-core chip, 8 was optimal.

### 2. Hybrid CPUs are not uniform, and pinning can backfire

`lscpu -e` on the 255H shows three tiers:

|CPUs|Max clock|L3 cache|
|---|---|---|
|0–5|5100 MHz|yes|
|6–13|4400 MHz|yes|
|14–15|**2500 MHz**|**none**|

Those last two are low-power E-cores on the SoC tile with no L3 at all. Since llama.cpp splits each layer across threads and waits for the slowest, they gate every token.

**But pinning with Docker's `cpuset` made things dramatically worse** — because `cpuset` restricts _which_ cores are available without changing how many threads Ollama spawns. It read 16 from the host and crammed them onto 6. Result: 0.20 tok/s.

Control the thread count. Don't bother with cpuset — in my testing it made almost no difference once threads were right.

### 3. A smaller context window makes things _slower_

This is the counterintuitive one, and the advice I'd been following had it exactly backwards.

My LLM running laptop memeory was filled fully with default settings, so as experiement I reduce the context at 16384, to control RAM. Then different problem it produced in the client side `Context overflow: prompt too large` on the word "Hello", because the framework's system prompt alone exceeds those limits.

Worse: when the window is too small, the prompt gets truncated or shifted, which **invalidates the prefix cache**. You then pay full prefill on every single message instead of once.

Ollama's own integration docs recommend at least 64k for local models; OpenClaw says 32k minimum. I settled on 32768. A 3B model's KV cache at 32k is only ~3–4GB.

### 4. The prefix cache is what makes this viable

Sending an identical prompt twice showed apparent prefill rates of 58,000–79,000 tok/s. That's not real throughput — it's the KV cache being reused.

This matters enormously, because an agent framework's system prompt is byte-identical every turn. You pay the full cost once per session, then near-zero.

Two things invalidate it: restarting the gateway, and the model unloading. Set `OLLAMA_KEEP_ALIVE` accordingly (with the caveat in the footnote below).

---

## Cutting the payload

In OpenClaw specifically, `tools.profile` is the knob. Four values: `minimal`, `coding`, `messaging`, `full`. Since version 2026.3.2, local onboarding defaults to `coding`.

```json
{
  "tools": {
    "profile": "minimal",
    "deny": ["group:fs", "group:runtime", "group:memory"]
  }
}
```

The explicit deny list isn't redundant — there's a known bug where `minimal` still exposes filesystem tools unless `group:fs` is denied.

**A trap:** the CLI flag `--profile minimal` is _not_ this. It selects a separate config _directory_ (`~/.openclaw-minimal/`), which is empty, so you get a confusing credentials error. Multiple guides conflate these.

### What it bought

|Config|Tools removed|Cold start|
|---|--:|--:|
|`coding` (default)|6|2m 21s|
|`minimal` + deny|24|1m 20s|
|`minimal`, cached|24|**20s**|

Note that removing 24 tools only halved it. Roughly 8,000 tokens remain — system prompt, workspace context, skills, memory. **Tool schemas were less than half the payload.** That's the ceiling of what config tuning achieves.

---

## Dead ends and bad advice

Things I chased that turned out to be wrong:

- **"Your instruct model is secretly a reasoning model."** `qwen3-4b-instruct-2507` is specifically the non-thinking variant; `/no_think` is meaningless for it. The garbled output was hardware, not thinking loops.
- **`OLLAMA_NUM_PARALLEL=1` prevents loading two models.** It doesn't — that's `OLLAMA_MAX_LOADED_MODELS`. `NUM_PARALLEL` controls concurrent requests against one loaded model.
- **Token soup diagnosed as a model problem.** Removing `OLLAMA_FLASH_ATTENTION` and `OLLAMA_KV_CACHE_TYPE=q8_0` fixed it. That combination with Vulkan on Intel graphics produced complete gibberish — which also appeared talking to Ollama directly, proving the framework was innocent.
- **Disabling gateway auth.** OpenClaw refuses to start (exit code 78) if auth is `none` while bound to LAN. That's deliberate — it won't let you expose an unauthenticated agent control plane to your network.

The broader lesson: I got a lot of confident, well-formatted, plausible-sounding advice that was wrong. What broke the cycle was measuring instead of reasoning about it.

---

## Final configuration

**Laptop — `docker-compose.yml`:**

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    devices:
      - /dev/dri:/dev/dri
    ports:
      - "<LAPTOP_IP>:11434:11434"
    volumes:
      - ollama:/root/.ollama
    environment:
      OLLAMA_HOST: "0.0.0.0"
      OLLAMA_VULKAN: "1"
      OLLAMA_CONTEXT_LENGTH: "32768"
      OLLAMA_KEEP_ALIVE: "-1"
      OLLAMA_NUM_PARALLEL: "1"
      OLLAMA_MAX_LOADED_MODELS: "1"
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  ollama:
    external: true
    name: ollama
```

Deliberately absent: `cpuset`, `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`.

**VM — `~/.openclaw/openclaw.json`:**

```json
{
  "tools": {
    "profile": "minimal",
    "deny": ["group:fs", "group:runtime", "group:memory"]
  },
  "models": {
    "providers": {
      "ollama": {
        "baseUrl": "http://<LAPTOP_IP>:11434",
        "contextWindow": 32768,
        "timeoutSeconds": 300,
        "params": { "num_thread": 8, "num_predict": 512 }
      }
    }
  }
}
```

---

## Part two: when the model became the ceiling

With the config tuned, CLI chat worked. Then I connected a Discord channel and it broke again — differently.

```
"error": "LLM request failed.",
"rawErrorPreview": "Ollama API stream ended without a final response"
```

Retried three times, ~9 seconds each. Too fast to be a timeout, too fast to be a cold prefill.

The logs showed the model calling `session_status` — the single tool `minimal` leaves available — against a Discord session key that didn't resolve. Four failed calls, then the stream died. I denied that tool too, leaving **zero** tools. The session errors vanished. The stream still died, now with a more precise label:

```
stopReason=error non-visible-output
```

With no tools to call, the model was returning nothing OpenClaw could render. I tested Ollama directly with a streaming request and got a clean `finish_reason: "stop"` — the server was fine. Then, after another config change, Discord finally produced output:

```json
{ "status": "error", "tool": "session_status",
  "error": "Unknown sessionId: user:1113542060033716250" }
```

A tool-call response, as plain text, for a tool that had been removed. The model wasn't calling anything. It had seen tool-call syntax in the system prompt and was **imitating the shape of one**.

That's the ceiling. Not a config problem — a capability problem. A 3B model handed a multi-thousand-token system prompt full of schemas doesn't reliably distinguish "here is how tools work" from "emit something that looks like this." Community guidance says 14B+ for reliable tool use, and this is what that guidance is describing.


---

## What I actually learned

### 1. In an agent framework, the system prompt is the workload

The mental model most people bring is "the model answers my question." For an agentic app it's closer to: the framework assembles a large document describing its entire capability surface, appends your message, and asks the model to continue it.

My measurements: `coding` profile ≈ 16,000 tokens. `minimal` with everything denied ≈ 8,000 tokens. **Removing 24 tool schemas cut less than half.** The rest was system instructions, workspace state, skill descriptions, and memory context.

That has a hard implication: there is a floor below which config tuning cannot take you, and on modest hardware that floor may still exceed what you can afford. Find it early by measuring, not by reading docs.

### 2. Prefill and generation are separate problems with opposite solutions

||Prefill (prompt eval)|Generation (token eval)|
|---|---|---|
|Bound by|compute|memory bandwidth|
|Helped by|GPU offload, more cores|faster RAM|
|Dominates|cold start|reply latency|
|My iGPU result|70 → 167 tok/s ✅|21.7 → 15 tok/s ❌|

Enabling the iGPU made generation ~30% _worse_ and was still clearly the right call, because agent workloads are prefill-dominated. Anyone benchmarking with "tokens per second" as a single number is measuring the wrong thing for this use case.

### 3. Prefix caching is the load-bearing optimisation

Cold start 80s, warm follow-up 20s. That 4× gap is the difference between unusable and usable, and it exists entirely because the framework's system prompt is byte-identical every turn and Ollama reuses the cached KV state.

Which means **anything that perturbs the prefix destroys your performance**: too small a context window (truncation shifts the prefix), a gateway restart, the model unloading, dynamic content injected near the top of the prompt.

This is why the "cap context to save RAM" advice was so damaging. It looked conservative and it made things categorically worse — smaller window → truncation → cache miss → full prefill on _every_ message instead of once.

### 4. Tool calling is a capability threshold, not a gradient

Small models don't do tool calling badly. They do something qualitatively different: they pattern-match the syntax. My 3B emitted a well-formed JSON tool response for a tool that did not exist in its context.

The failure modes escalated in a way worth recognising:

1. Empty responses (`non-visible-output`)
2. Hallucinated tool-call JSON as prose
3. Degenerate repetition loops under long context

None of these are fixable with temperature, sampling parameters, or prompt tweaks. They're symptoms of a model below the threshold for the task. Sizing the model to the _framework's_ prompt complexity matters more than sizing it to your hardware.

### 5. Error messages in layered systems are unreliable by construction

Real examples from this build:

|Message|Actual cause|
|---|---|
|"The selected model was not found by the provider"|No credential in the agent's auth store|
|"LLM request failed"|Model produced empty output|
|"Context overflow: prompt too large"|Context window set too small, not prompt too big|
|"Config validation failed: Invalid input"|Slash in a config key parsed as a nested path|

Each layer catches an exception and re-describes it in its own vocabulary. By the time it reaches you it names the layer's concern, not the root cause. **Trust logs and direct probes over surfaced error strings.** Curling the provider API directly answered in seconds what the error message had obscured for an hour.

### 6. Multiple sources of truth for config will eat your evening

Four credential stores, written by different commands, read by different components, with no diagnostic that shows which one is authoritative. `models status` reported the provider as authenticated while the agent had no credential — both statements true, about different stores.

If you're evaluating an agent framework, this is worth probing early: _where does configuration actually live, and what reads it?_ A tool that silently accepts writes to a location nothing reads is far more expensive to debug than one that errors loudly.

Practical defence: prefer the tool's own onboarding flow over hand-editing config. The flow writes to every location it needs to. Manual edits reach exactly one.

### 7. Bisect, don't theorise

The debugging that worked followed one pattern: **change one variable, measure, keep or revert.**

The thread-count sweep found a 50× cliff in four commands. Curling Ollama directly proved the framework innocent of the streaming failure. Denying one tool at a time isolated the session bug. Checking `models auth list` ended an hour of speculation in one line.

The debugging that failed was theorising from plausible mechanisms. I was confidently wrong about oversubscription, about streaming, about timeouts. Every wrong theory sounded good and cost real time. **A ten-second probe beats a compelling explanation.**

### 8. Decide where the work runs based on prompt shape

The decision isn't local-vs-cloud. It's prompt size:

- **Small, repetitive prompts** — HTML to JSON, classification, extraction. A 7B model on this laptop returns results in under a second. Local wins outright: free, private, fast.
- **Large system prompts with tool schemas** — agent loops. Local means an 80-second cold start and a model below the capability threshold. Cloud wins.

My original goal was a crawler: fetch pages, extract structured data. That is squarely the first category and would have worked on day one. I drifted into the second category by adopting a general agent framework, and everything got hard.

**Match the tool to the prompt shape, and check that you haven't drifted from the problem you actually had.**

---

## Where it ended

- **Local Ollama, benchmarked and stable.** 167 tok/s prefill, ~15 tok/s generation, no corruption. Genuinely good at small-prompt extraction — the original goal.
- **OpenClaw on a local 3B: works as a chatbot, fails as an agent.** Below the capability threshold, and no config fixes that.

Would I do it again? The benchmarking, yes — I now understand this hardware properly, and that knowledge transfers to every local model I run. The framework wrestling, no. I'd have pointed it at a cloud model on day one to establish a working baseline, _then_ substituted the local model as a controlled experiment.

Establish a known-good path first. Change one thing at a time. Measure everything.

---

### Footnotes / unverified

- I attributed the prefill speedup to the iGPU based on before/after timings, but haven't confirmed it with `intel_gpu_top` during a request. Worth verifying before copying the `/dev/dri` passthrough, since that path has produced corrupted output on this machine.
- `OLLAMA_VULKAN` and `OLLAMA_IGPU_ENABLE` don't appear in Ollama's documented environment variables. Check `docker logs ollama` for which runner it actually selects.
- `OLLAMA_KEEP_ALIVE: "-1"` appears to keep a core spinning on llama.cpp's busy-wait barrier when idle. On a laptop, `"30m"` may be the better trade.
- The 20-second warm figure is a single measurement, not a sustained average, and I'd expect it to degrade as session history grows.
- Version-specific: OpenClaw 2026.7.1-2. The credential-store layout and CLI parsing quirks may differ in other releases.