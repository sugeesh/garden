Date - 28/07/2026

Our first session of the AI study group. We're working through Chip Huyen's _AI Engineering_ (2024) over 10 sessions, one chapter each, to build a foundational understanding of AI applications. This was the introductory session on Chapter 1, a broad pass over the landscape, with a note that the book has roughly a two-year industry gap we'll be filling in as we go.

## What we covered

**Foundations**

- The scope of Chapter 1: the rise of AI, and the distinction between Language Models, Large Language Models, and Foundation Models
- Language models as next-word predictors — masked vs. auto-regressive types
- Tokenization: tokens as the model's "alphabet," sub-words, and vocabulary size (GPT-3 ~50k tokens vs. newer models at 100k–200k)
- The rough rule that ~100 tokens ≈ 75 words, and how sub-words and punctuation push token counts above word counts
- Self-supervised learning vs. traditional supervised learning, and why it's what makes scaling possible
- Growth in model size: GPT-2 (1.5B) → GPT-3 (175B), with the typical 7B–70B range used in practice
- Foundation and multi-modal models spanning text, code, image, and video

**AI engineering as a field**

- The three areas of work — application development, model development, infrastructure — and where AI engineers sit
- Traditional ML vs. AI engineering: custom task-specific training vs. model-as-a-service on public foundation models
- Core skills: prompt engineering, context engineering, RAG, and interface design

**Running models locally & hardware**

- Tools for running models locally: llama.cpp, LM Studio, and Hugging Face as a model/dataset repository
- The three hardware paths — CPU (system RAM), Nvidia GPU (VRAM), Apple Silicon (unified memory) — and the fact that the model has to fit in available memory
- Apple M-series vs. Intel Ultra: unified memory acting as VRAM, and the large throughput gap (~546 vs. ~120 tokens/sec)
- The Apple Neural Engine (raised as an open question)
- Quantization (e.g. 4-bit) to shrink models — an FP16 model dropping from ~2GB to ~0.6GB
- Parameters as a measure of a model's capacity to learn

**Beyond the book**

- The shift after GPT-4 toward reasoning models — breaking problems into steps and using reinforcement learning — with DeepSeek as a lower-cost example
- RAG for accessing private or specific documents via a vector database, without training or fine-tuning the model
- RAG vs. MCP servers — static retrieval vs. frequently changing data
- Agentic AI: apps like Claude Code that loop until a goal is met, and frameworks like LangChain / LangGraph
- Supervised vs. unsupervised learning
- Hardware for agentic apps: not demanding if you connect to an external LLM, only heavier if you run the model locally (e.g. via Ollama)

## Open questions to follow up

- How PDFs get tokenized and stored as vectors in a RAG pipeline
- What the Apple Neural Engine actually does
- The relationship between vocabulary size and parameter size
- The role of neural networks in reasoning models vs. earlier models like GPT-4

## Next session

Model training and the Transformer architecture.

## Slides
