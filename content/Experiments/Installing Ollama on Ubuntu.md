

1. Install Docker

`sudo apt-get update`
`sudo apt-get install -y ca-certificates curl`
`sudo install -m 0755 -d /etc/apt/keyrings`
`sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc`
`sudo chmod a+r /etc/apt/keyrings/docker.asc`

`echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \`
  `| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`

`sudo apt-get update`
`sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`

sudo usermod -aG docker $USER



2. Start the Ollama container

CPU-only:

`docker run -d \`
  `--name ollama \`
  `-p 11434:11434 \`
  `-v ollama:/root/.ollama \`
  `--restart unless-stopped \`
  `ollama/ollama`



3. Pull the model
`docker exec -it ollama ollama pull qwen3:4b-instruct-2507-q4_K_M`


4. Run it
`docker exec -it ollama ollama run qwen3:4b-instruct-2507-q4_K_M`


| Part         | Value        | What it means                                                                                                                                           |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family       | **Qwen3**    | The model family and generation — Alibaba's third major Qwen release                                                                                    |
| Size         | **4B**       | 4 billion parameters — the size of the model. Bigger = smarter but slower and heavier on RAM                                                            |
| Tuning       | **Instruct** | Fine-tuned to follow instructions and chat. (Alternatives: *Base* = raw text completion, not conversational; *Thinking* = shows step-by-step reasoning) |
| Version      | **2507**     | Release datestamp — year/month, so July 2025                                                                                                            |
| Quantization | **Q4**       | 4-bit quantization — weights compressed to 4 bits each, shrinking size and speeding up inference at a small quality cost                                |
| Quant method | **K_M**      | "K-quant, Medium" — a specific quantization scheme. The medium variant balances quality vs. size well                                                   |


**Freeing memory.** The model stays loaded for a few minutes after you exit the chat. To evict it immediately:

bash

```bash
docker exec ollama ollama stop qwen3:4b-instruct-2507-q4_K_M
```



**Stopping and starting.** If you didn't use `--restart unless-stopped`, the container won't come back after a reboot:

bash

```bash
docker start ollama
```


Use GPU ( Integrated ArrowLake ):

```
docker rm -f ollama

docker run -d \
  --name ollama \
  --device /dev/dri \
  -e OLLAMA_VULKAN=1 \
  -e OLLAMA_IGPU_ENABLE=1 \
  -p 127.0.0.1:11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama
  
docker logs ollama 2>&1 | grep -i "inference compute"
docker exec ollama ollama run qwen3:4b-instruct-2507-q4_K_M "hi"
docker exec ollama ollama ps

```





