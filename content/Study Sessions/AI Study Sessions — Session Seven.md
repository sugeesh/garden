Date - 09/09/2026

Session Six ended with a working retrieval pipeline and an uncomfortable question left hanging: what happens when semantic similarity is the wrong tool for the query?

This session was the answer, or at least the beginning of it. We rebuilt the indexing pipeline properly in Python with Docling and PGVector, then went looking for the queries where cosine similarity falls over and keyword search does not. Hybrid search is the usual prescription, and we wanted to see the disease before reaching for the cure.

What we found was more interesting than the demo we had planned.

## What we covered

### The pipeline, stage by stage

The whole index now runs through four stages, and the first one does more than its name suggests.

`DoclingLoader` defaults to `ExportType.DOC_CHUNKS`, which means loading and chunking happen in the same call. There is no separate splitter step, because Docling's `HybridChunker` has already done that work, structure-aware chunks that respect headings and tables rather than cutting at a fixed character count. The Attention paper came out as 58 chunks, between 69 and 1232 characters, averaging 672.

A naming trap worth stating out loud: Docling's chunker is called *hybrid* because it is structural first and token-merging second. It has nothing to do with hybrid *search*. Both words appear in the same notebook and they mean completely different things.

Embedding is `nomic-embed-text` served by Ollama on another machine, producing 768 dimensions. Storage is Postgres through `PGEngine` on asyncpg: `init_vectorstore_table` declares the metadata columns, `PGVectorStore.create_sync` builds the store, the 58 documents go in with fresh UUIDs, and an HNSW index is applied afterwards. Queries run cosine similarity through `similarity_search_with_score` with k=3.

### Why we went looking for a failing query

The case for hybrid search only lands if the room has seen semantic search fail. So we needed a query where embeddings have nothing useful to work with.

`P100` is that query. It is an NVIDIA data-centre GPU from 2016, mentioned once in the paper's training section, and as a string it is a letter and a number. There is no concept behind it for an embedding model to place in meaning space. But appearing in exactly one chunk out of 58 makes it enormously informative to a keyword scorer like BM25.

The mirror case is a query with no matching words at all: *how do you stop the decoder seeing future words*. The paper says masking and auto-regressive and never uses the words in the question. BM25 has nothing to match; the embedding finds it easily.

> Run both. If you only show the first one, everyone leaves thinking keyword search was the answer all along.

### The demo refused to break

`P100` did not fail. At 58 chunks, three results out of fifty-eight is a wide net, and the right chunk kept coming back, sometimes by accident, with a mediocre score, but it came back.

This turned out to be the most useful thing in the session. The failure mode we were trying to show is real, but it bites at ten thousand chunks, not fifty-eight. A corpus that small is simply too forgiving.

So we reframed the demonstration around rank rather than presence. Print the position of the correct chunk under semantic search, under BM25, and under a fused ranking. Semantic buries it at fourth; BM25 puts it first; hybrid puts it first. Nothing dramatic happens on screen, but the claim survives scrutiny, and *we buried the right answer at rank four* is a failure every team recognises from their own systems.

One other thing surfaced during the run that is worth separating carefully: on one query the pipeline retrieved the correct chunk and the model still answered that it had no specific information. That is a generation failure, not a retrieval failure. Two different bugs, and mixing them confuses the room.

### The metadata layer was doing nothing

Keyword, semantic and metadata filtering are usually taught as three complementary jobs. Ours only had two working legs.

Every row in the table had `page = 0`, because Docling does not put a page number at the top level — it sits at `dl_meta.doc_items[0].prov[0].page_no`. `doc_id` was hardcoded to a filename that was not the document being indexed. And `dl_meta` was dropped entirely on the way in, which threw away the single most useful field: `headings`. The chunk that wins a query about attention knows it sits under section 3.2, and that heading never reached Postgres.

A filter that filters nothing is worse than no filter, because it looks like it works.

### Where this fits for AI engineering

The honest lesson of the session is about corpus size rather than about algorithms. Retrieval behaviour at fifty-eight chunks tells you almost nothing about retrieval behaviour at ten thousand, and a demo that cannot fail is a demo that cannot teach. Indexing two or three more papers alongside the first would have fixed both the failing-query problem and the metadata-filter problem at once, since there would finally have been more than one document to filter by.

## Open questions to follow up

- How the fused ranking is actually computed, and whether reciprocal rank fusion is enough or weights need tuning per corpus
- What corpus size the identifier queries start failing at on their own
- Whether recovering `dl_meta.headings` into a declared column is worth the ingest complexity
- How to evaluate any of this without hand-checking each result, which is the eval question we keep deferring

## Next session

Two halves. First, closing out hybrid search with the fusion piece actually implemented and measured. Then a pivot into the LangChain course and the agent-building module.

The bridge between them is the interesting part: expose the retrieval endpoint as a service the agent calls as a tool, so the first half becomes the thing the second half uses, rather than two unrelated topics sharing an hour.

## Resources

- Vaswani et al. 2017 — *Attention Is All You Need*, the indexed corpus
- Docling documentation — `DoclingLoader`, `ExportType.DOC_CHUNKS`, `HybridChunker`
- `nomic-embed-text` on Ollama
- LangChain Postgres documentation — `PGEngine`, `PGVectorStore`, HNSW indexing

## Slides

[[session-7-hybrid-search.pdf]]

## Session
