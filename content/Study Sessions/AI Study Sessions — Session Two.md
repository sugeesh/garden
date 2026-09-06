Date - 04/08/2026

Our original plan was to continue directly into Chapter 2 of Chip Huyen’s _AI Engineering_. However, we realised that several ideas in the chapter would be difficult to understand properly without first knowing what happens inside a language model.

Rather than memorising terminology at the application layer, we decided to take a short trip under the hood.

For this session, we followed the first part of Andrej Karpathy’s _The Spelled-Out Intro to Language Modeling: Building makemore_. The walkthrough builds a bigram character-level language model and introduces the broader language-modelling workflow: representing data with tensors, generating outputs by sampling, and evaluating a model using negative log likelihood.

The goal was intentionally small: build a complete working language model using counting alone, without a neural network, gradients, or a training loop.

## Why we changed direction

The book focuses primarily on building applications using existing foundation models. That is still our main destination.

However, concepts such as model training, scaling laws, evaluation, embeddings, context, and post-training become much easier to reason about after seeing a small language model work from beginning to end.

We are therefore spending a few sessions building the concepts from the bottom up:

1. Language modelling through counting
2. The same model implemented as a neural network
3. Longer context and learned representations
4. Self-attention
5. A small Transformer and GPT-style model

After that, we will return to the book with a better mental model of what is happening beneath the APIs.

## What we covered

### A language model in its smallest useful form

We used **makemore**, a character-level language model that takes a collection of names and attempts to generate new, name-like strings.

The dataset contains:

- 32,033 names
- 26 lowercase characters
- One special start-and-end symbol
- Approximately 228,000 character pairs

Each name contains multiple training examples. For example, a name does not only teach the model which character starts it. It also teaches which characters commonly follow one another and which characters are likely to end a name.

At this level, a language model can be described as:

> Given the symbols seen so far, produce a probability distribution for the next symbol.

Modern language models perform this operation using much larger vocabularies and longer contexts. This model used only 27 possible symbols and one character of context. The task is conceptually similar, but the scale and model architecture are very different.

### The bigram simplification

A **bigram** consists of two consecutive characters.

The first character is the context, and the second is the character the model needs to predict. A bigram model therefore looks back exactly one character and ignores everything before it.

For the name `emma`, the training pairs are conceptually:

```
. → e
e → m
m → m
m → a
a → .
```

The `.` symbol represents both the beginning and the end of a name. The ending symbol is important because the model needs a way to decide when generation should stop.

This is a deliberately limited model. When predicting the character after `m`, it cannot remember whether the name started with `e`, how long the name is, or which earlier characters appeared.

### Training by counting

For this model, training meant walking through the dataset once and counting how frequently each character followed another character.

We stored the counts in a two-dimensional PyTorch tensor:

```
N[i, j]
```

Each row represents the current character, and each column represents a possible next character. The value at `N[i, j]` records how often character `j` followed character `i` across the complete dataset.

There were no epochs, gradients, learning rates, or parameter updates. Once every pair had been counted, the training process was complete.

This was also our first practical introduction to PyTorch tensors. Although PyTorch is commonly associated with neural networks, its tensor operations are useful for representing and manipulating any multidimensional numerical data.

### From counts to probabilities

Raw counts are not yet a probability distribution.

To convert them, we divided every value in a row by the total of that row:

```
P = N.float()
P /= P.sum(1, keepdim=True)
```

After normalisation, every row sums to one.

A row no longer says that a particular character appeared a certain number of times. It says that, given the current character, each possible next character has a particular probability.

Also discussed a subtle PyTorch broadcasting issue involving `keepdim=True`. Removing it can change the shape of the result and cause normalisation to happen along the wrong dimension. The program still runs, but silently produces an incorrect model, a useful example of code that is syntactically and type-correct while being logically wrong.

### Generating names through sampling

Once we had a probability distribution, generation followed a loop:

1. Look up its probability distribution
2. Sample the next character
3. Append that character to the result
4. Use it as the next context
5. Stop when the model samples the end symbol

We used `torch.multinomial` for sampling.

Sampling does not simply select the character with the highest probability. It makes a random selection weighted by the probability distribution. More likely characters are selected more frequently, while less likely characters remain possible.

The generated names were not particularly good, but they were recognisably more name-shaped than uniformly random character sequences. They often placed vowels in plausible positions and stopped at reasonable lengths.

That distinction was important: poor output does not necessarily mean that the model learned nothing.

### Evaluating the model

Looking at generated names gives us an intuition about quality, but we also need a numerical way to compare models.

We introduced **negative log likelihood**.

The process can be understood in three stages:

- **Likelihood:** multiply the probabilities assigned to every character pair that actually occurred
- **Log likelihood:** take the logarithm so that the multiplication becomes addition and remains numerically manageable
- **Negative log likelihood:** negate and average the result so that lower values represent better models

Our counting model produced a negative log likelihood of approximately `2.45`, compared with approximately `3.29` for uniform random guessing.

The exact number matters less than the principle:

> A loss function converts “does this model look good?” into a number that can be measured and minimised.

The same general next-token prediction objective remains relevant when moving from this small counting model to much larger language models.

### Zero probabilities and smoothing

A problem appears when a character pair never occurs in the training dataset.

Its probability becomes zero, and the logarithm of zero is negative infinity. A single impossible pair can therefore make the loss for an entire sequence infinite.

The solution is **smoothing**: add a small value to every count before normalising.

For example:

```
P = (N + 1).float()
P /= P.sum(1, keepdim=True)
```

This ensures that no transition is considered completely impossible, only unlikely.

The amount of smoothing is our first **hyperparameter**. This also led to an important distinction:
- A **parameter** is learned from data.
- A **hyperparameter** controls how the model or learning process behaves.

Hyperparameters should be selected by evaluating performance on data that was not used to build the model. This introduces the motivation for train, validation, and test splits.

## AI engineering versus model foundations

We also revisited the distinction between AI engineering and model development.

An AI engineer will often work above the model layer: integrating models, constructing context, implementing retrieval, designing evaluations, building observability, and operating the surrounding infrastructure.

That does not mean every AI engineer needs to train a foundation model from scratch.

However, going through this process once helps us understand what the APIs are hiding. It gives us a more concrete way to reason about probabilities, context, sampling, loss, model limitations, and evaluation.

The purpose of this detour is not to move away from AI engineering. It is to return to it with a stronger foundation.


## Next session

We will implement the same bigram model as a neural network.

Instead of directly counting character pairs, we will introduce one-hot encoding, weights, logits, softmax, loss, gradients, and gradient descent. The goal is to reach approximately the same result through learning rather than counting and understand why that more complicated route becomes useful as models grow.

From there, we will gradually move toward longer contexts, embeddings, self-attention, Transformers, and eventually a small GPT-style model.

## Resources

- [Andrej Karpathy — _The Spelled-Out Intro to Language Modeling: Building makemore_](https://www.youtube.com/watch?v=PaCmpygFfXo)

## Slides

[[session2_language_modeling.pdf]]

## Session

https://youtu.be/kKNs7jlFm18