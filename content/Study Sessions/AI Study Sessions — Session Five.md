Date - 28/08/2026

Our plan for this session was makemore part 2, which builds a multi-layer perceptron language model with learned embeddings.

The video runs about an hour and fifteen minutes, which is more than a one-hour session can carry honestly. So we split it at the natural seam. This session ends at the moment we print a first loss number, roughly thirty-five to forty minutes in, immediately after the summary of the complete network. Everything after that point — finding a good learning rate, the train, validation and test splits, plotting the embeddings, and sampling from the model — becomes the following session.

The split is clean because the first half is one complete story: the architecture. Training is the sequel rather than a missing piece.

There is a deliberate consequence to stopping here. The loss we printed is terrible, because the weights are random and nothing has been trained. That is not a failure to apologise for. It is the reason the next session exists.

## What this session changed

Session Four's model looked at one character and could not look at more without the table exploding. This one looks at three, by giving every character a short vector of learned numbers instead of a twenty-seven-slot one-hot vector, then feeding those vectors through a hidden layer.

> three characters → six numbers → hidden layer → 27 logits → softmax → loss

The training loop is unchanged. Only the front of the network is different.

## Why we had to leave counting behind

The count table cannot widen its context. One character of context is 27 rows. Two is 729. Three is 19,683. Five is 14.3 million, against a dataset of roughly 228,000 pairs. The table becomes overwhelmingly empty, and an empty cell teaches nothing.

The trap we walked straight into was assuming that three characters of context requires 27 × 27 × 27 inputs.

It does not, and that is the entire point of the paper. The 27³ explosion is what a lookup-table approach costs. The multi-layer perceptron never enumerates the combinations at all. It has six input numbers, and the network finds the patterns in them. Six inputs, regardless of how large the vocabulary becomes.

## Bengio et al. 2003, and the fix it proposed

The paper is twenty-three years old and still describes the shape of every model since. Three points carry the whole contribution.

First, give every symbol a short vector. In the paper, seventeen thousand words were each mapped to a thirty-number feature vector. Not a slot in a table, but a position in a space.

Second, let the network learn those vectors. They start random and are trained by the same gradient descent that trains everything else in the network.

Third, similar symbols end up close together. Symbols used in similar contexts drift toward each other, so the model can generalise to sequences it has never encountered.

The third point is the one that beats counting. A count table has no notion of similarity. If it never saw a particular trigram, it knows nothing about it, permanently. An embedding space allows a model to transfer what it learned about one context to a neighbouring one it has never seen. Generalising between similar contexts is something counting can never do.

What we built is the character-level version of exactly this paper.

## What we covered

### The sliding window and building the dataset

Block size is the number of previous characters the model can see, which is three here. Sliding that window along each name one character at a time gives one training example per position: three characters in, one character out.

With dot-padding, `emma` produces:

```
... → e
..e → m
.em → m
emm → a
mma → .
```

### From one-hot to embedding

Session Four ended on the observation that multiplying a one-hot row by a matrix is only a row lookup. This is where that observation gets cashed in.

If it is only ever a lookup, there is no reason to perform the multiplication. Keep a table, called `C`, and index into it directly.

The change in size is worth going through slowly. Before, one character came in and became twenty-seven numbers, the one-hot vector. Now, three characters come in and each becomes just two numbers from the table, so 2 + 2 + 2 = 6.

Twenty-seven shrank to six while the context tripled. That works because meaning is now stored in two real numbers rather than spread thinly across twenty-seven mostly-zero slots.

### What an embedding actually is

An embedding is a learned vector of numbers standing in for a symbol. Twenty-seven characters, each assigned its own short list of numbers, kept in a lookup table.

They begin random. As the network trains, gradient descent nudges them so that characters behaving similarly acquire similar numbers. Vowels drift together, not because anyone labelled them as vowels, but because they predict similar next characters. The structure is a consequence of the training objective and never an instruction.

### Reading `C[X]` as shapes

This was the part the group kept returning to, and shapes are the only thing that make it click.

The table `C` has shape 27 × 2, one row per character with two numbers each. The dataset `X` has shape 32 × 3 for a batch of thirty-two examples with three character indices each. Indexing gives `C[X]` with shape 32 × 3 × 2, where every index has been replaced by its two-number row. Then `emb.view(32, 6)` gives shape 32 × 6, with the three embeddings flattened into a single row per example.

The useful way to describe `C[X]` is as a phone book lookup performed ninety-six times at once. You hand PyTorch a grid of names and it hands back a grid of numbers, preserving the shape and appending the vector dimension on the end. Nothing is computed; everything is fetched.

Printing all three tensors live and letting people match the numbers by eye is considerably more convincing than the explanation.

### Concatenating versus viewing

The three separate two-number embeddings need to be glued into one row of six. `torch.cat` does that explicitly, and it is shown first because it is honest about what is happening.

`view` then does the same thing more cleanly and at no cost, because it reinterprets the existing memory rather than copying it. Concatenation is the teaching step; `view` is the code that stays.

### The hidden layer and the output layer

Six numbers enter the hidden layer, being three characters at two dimensions each. The hidden layer has one hundred neurons with a `tanh` activation, and its outputs are the activations. The output layer has twenty-seven outputs, which are the logits, one per possible next character.

That is two weight layers after the lookup. Compared with Session Four — twenty-seven in, twenty-seven out, one matrix, nothing hidden — the output side is unchanged. It is still predicting one of twenty-seven characters. The input side is what has been rebuilt.

### How the embedding table gets trained

This question came up twice, because a lookup does not look like it computes anything.

Indexing is a differentiable operation like any other, and `C` sits in the parameter list. During the backward pass, gradients flow back through the network to the specific rows that were selected for this batch, and those rows get nudged. Rows that were not used in a given step receive no gradient in that step.

So the embedding table is not a preprocessing stage bolted onto the front of the network. It is a layer, trained in the same backward pass as everything else. The lookup and the rest of the network learn together, from one loss.

### Cross entropy

`F.cross_entropy` replaces the hand-written softmax followed by negative log likelihood from Session Four. It is softmax and negative log likelihood fused into a single numerically stable operation: the same mathematics, fewer intermediate tensors, and no overflow on large logits. Writing it out longhand was the teaching version; this is the production version.

### Minibatches, previewed

The full dataset is too large to run every step on, so each step uses a minibatch, a random subset, and performs the forward pass, backward pass, and update on that subset alone.

The consequence worth pre-empting is that each batch produces a slightly different gradient, so the loss jumps around rather than falling smoothly. It will sometimes go up. That is expected and fine. The direction is still correct; the path simply zigzags toward it. This question always arrives, and it is better raised in advance than explained after someone panics at a rising number.

## Getting the words right: embedding, embed, embedded

A small thing that kept tripping up the explanation.

An **embedding** is a noun: the vector itself. To **embed** is a verb: the act of turning a symbol into that vector. You embed a character to obtain an embedding. **Embedded** simply means placed inside something; the layer is embedded in the network, and the word says nothing about whether any weights have been trained.

Related to that, a pretrained embedding model and a freshly initialised one are both embedding models, at different stages. Being trained is not part of what the word means.

We also asked whether what we built counts as an embedding model. Sort of, but not a standalone one. The embedding table is one layer inside the network, trained jointly with the rest, and there is no separate artifact anyone would ship — though the table could technically be pulled out.

## Where this shows up in application work: RAG

This is the bridge that makes the session worth an application-layer engineer's hour.

In a retrieval-augmented generation pipeline built with Spring AI, text goes to an embedding model, comes back as a vector, is stored in a vector database, and retrieval is nearest-neighbour search in that space. That is the same idea as the table `C`: symbols as positions in a space, where closeness means similarity.

The difference is ownership. In RAG you are borrowing someone else's learned space; here you are growing your own tiny one. Two dimensions instead of 1,536, characters instead of paragraphs, but the same machinery.

One objection came up and is worth recording, because it marks the exact point where the two senses of "embedding" stop being identical. Paragraphs do not follow one another the way characters do, so how can next-token prediction produce a paragraph embedding?

It does not. Sentence and document embedders are trained on similarity pairs rather than next-token prediction: pull texts that mean the same thing together, push unrelated ones apart. A different training objective, using the same underlying machinery of learned vectors in a shared space.

## Vocabulary

Everything below came out of something we built today, rather than arriving as an abstraction. That ordering is worth keeping for the rest of the series.

- **Embedding** — a short learned vector standing in for a symbol
- **Embedding table** — the matrix those vectors are rows of; here `C`, at 27 × 2
- **Context window** — how many previous symbols the model can see, called block size in this code
- **Activations** — the output of a hidden layer, after its non-linearity
- **Logits** — the final raw scores, before softmax, and only ever the last layer
- **Cross entropy** — softmax and negative log likelihood in one stable operation
- **Minibatch** — a random subset of the data used for one update step
- **Learning rate** — how large a step is taken when nudging the parameters

## Where this fits for AI engineering

This is the first session where the theory and the applied track met in the same room. Embeddings are not background material for someone building retrieval pipelines; they are what the pipeline is made of.

Having watched a 27 × 2 table learn its own structure from nothing but a loss, a vector database stops being a component to call and becomes something that can be reasoned about: why chunk size matters, why the choice of embedding model matters, and why similarity is not the same thing as relevance.

The theory is still timeboxed. This session earns its hour on application-layer grounds rather than only foundational ones.

## Resources

- [Andrej Karpathy — _Building makemore Part 2: MLP_](https://www.youtube.com/watch?v=TCH_1BHY58I) (first half)
- Bengio et al. 2003 — _A Neural Probabilistic Language Model_
- [makemore repository](https://github.com/karpathy/makemore)


## Session

https://youtu.be/B5Vc2--GkPg