Date - 21/08/2026

This session was the return trip from the detour.

Session Two covered only the first half of makemore part 1: the counting bigram, built from probability tables with no neural network anywhere in it. We stopped there because the second half reframes that same model as a neural network, and we could not follow it without backpropagation. Session Three went to micrograd to build that foundation.

Everything Session Three unlocked — the computation graph, the backward pass, the nudge step — was pointed at a real language model for the first time here. The plan we wrote down at the end of the previous session is what actually happened.

The session ran as two halves: the neural bigram for the bulk of the hour, and a demonstration of an agent project at the end.

## The idea, before any code

Take the bigram table from Session Two and throw the counting away. Instead, learn the numbers in that table by gradient descent, using the micrograd loop from Session Three scaled up from single values to tensors:

> forward → loss → backward → update → repeat

The counting model fills in a 27×27 table by tallying pairs. The neural model learns a 27×27 matrix by being wrong and correcting itself. Two roads to the same destination.

## Same job, different machinery

Stating the comparison before the code helps, because the two models are genuinely doing the same job.

In the counting model, the knowledge lives in a 27×27 table of counts. It gets there by tallying every pair in the dataset once. Counts become probabilities by dividing each row by its sum. Unseen pairs are handled by adding fake counts, which we called smoothing. The final loss was about 2.454.

In the neural model, the knowledge lives in a 27×27 matrix of weights. It gets there by random initialisation followed by thousands of gradient steps. Weights become probabilities by applying softmax across the row. Unseen pairs are handled by adding a penalty on the size of the weights, which is called regularization. The final loss is about 2.45.

The obvious question is why we would bother, given that the loss is the same.

The answer is that the counting approach cannot grow. Widening the context from one character to three takes the table from 27 rows to 19,683. Widening it to five takes it to 14.3 million rows, against a dataset of roughly 228,000 pairs. The table becomes overwhelmingly empty and the model learns nothing from it.

The neural version does not have that wall. The input changes and the same training loop keeps working. Everything between here and a Transformer is this loop with a larger middle. That is the whole argument for switching, and it sets up the next session.

## What we covered

### The training set

Every bigram becomes one input-and-label pair. One tensor holds the index of the current character, another holds the index of the next one. The name `emma` gives `.e`, `em`, `mm`, `ma`, `a.` — five examples out of one name. It is an ordinary supervised dataset with nothing clever about it.

### One-hot encoding the input

A character index is an arbitrary integer. Feeding `13` into a network implies that `m` is thirteen times something, which is meaningless. So each index becomes a one-hot vector: twenty-seven zeros with a single one at the character's position.

One consequence of this is worth holding onto, because the next session depends on it entirely:

> Multiplying a one-hot row by a matrix is just a row lookup.

The zeros eliminate every other row, and only the row at the hot position survives. Nothing is being computed. A row is being selected.

### The weight matrix

A single matrix, 27 by 27, initialised with `torch.randn`. Twenty-seven inputs to twenty-seven outputs, one row per input character and one column per possible next character.

The distinction between `randn` and `rand` caused some confusion and is worth writing down. `torch.randn` draws from a normal distribution with mean zero and variance one, so about half the values come out negative and roughly two thirds land between −1 and +1. `torch.rand` draws uniformly between zero and one, so every value is positive. `randn` is the correct choice for weight initialisation, because a uniform 0-to-1 draw would bias every logit positive before training had even started.

We also asked why there is no bias term, given that the standard description of a layer is `Wx + b`. There are two reasons and they stack. With one-hot inputs each input selects exactly one row of the matrix, so a bias would only add the same constant to every logit. And softmax is shift-invariant, meaning that adding a constant to all logits changes nothing after normalisation. The bias is not omitted for simplicity; it is omitted because it provably does nothing here. It returns in the next session, where there is a real hidden layer.

### Logits, counts, and probabilities

```python
logits = xenc @ W        # log-counts
counts = logits.exp()    # "counts", all positive
probs  = counts / counts.sum(1, keepdims=True)
```

The name "logits" has two explanations and both hold. Within this video's story, exponentiating the logits produces something that behaves like counts, so the logits are the log of the counts. That deliberately mirrors the count table from Session Two. In general usage the term comes from logistic regression, where a logit is the log-odds, and it simply means the raw pre-activation score coming out of the linear layer before any softmax or sigmoid is applied.

A point of confusion worth untangling: exponentiating is not a step that sits outside the activation function. It is the first half of it. Softmax means exponentiate everything, then divide by the sum. The two lines above are one operation, written out longhand so that the "counts" interpretation stays visible.

We also asked why softmax rather than sigmoid. Sigmoid squashes each output independently, so the twenty-seven numbers would not sum to one and could not be sampled from. Sigmoid is for binary decisions or independent multi-label decisions. Softmax is for choosing one from many mutually exclusive options, which is exactly what predicting the next character is. Every language model, from this twenty-seven-character one up to the largest Transformers, ends in a softmax over its vocabulary. Only the size of the vocabulary changes.

### The loss

The loss is negative log likelihood, the same measure introduced in Session Two. Pull out the probability the network assigned to the correct next character, take its logarithm, negate it, and average over all examples.

```python
nlls = torch.zeros(5)
for i in range(5):
    x = xs[i].item()          # input character index
    y = ys[i].item()          # label character index
    p = probs[i, y]           # probability given to the correct character
    nlls[i] = -torch.log(p)
print('loss =', nlls.mean().item())
```

The logarithm is what makes this a good loss function rather than an arbitrary one. It punishes the model severely for assigning near-zero probability to something that actually happened, so a confident wrong answer costs far more than a hedged one.

### The training loop

The same four beats as micrograd, with tensors in place of scalar value objects:

```python
loss.backward()            # backprop — fills W.grad
W.data += -0.1 * W.grad    # gradient descent — the update step
```

We kept collapsing two ideas that need to stay apart. Backpropagation computes the gradients; it reports the slope, meaning the direction that would make the loss go up. Gradient descent is the update step itself, the second line, which moves in the opposite direction and therefore downhill. Backpropagation tells you the slope and gradient descent takes the step. PyTorch's `backward()` only does the first job. The `0.1` is the learning rate, which controls how large the step is.

### Regularization, which is smoothing in different clothes

Adding `+ 0.01 * (W**2).mean()` to the loss took a few passes to make sense of.

The puzzle is how adding a positive number can push weights toward zero. The penalty is indeed always positive and it does make the total loss larger, and that is precisely the point. Gradient descent minimises the total, and the only lever it has for shrinking the penalty term is to shrink the weights. So the weights slide toward zero, but not all the way, because the data term pushes back. The result is a compromise: weights large enough to fit the patterns and no larger.

Squaring matters too. If the penalty were plain `W`, a weight of −5 would lower the loss, and the model would happily drive weights hugely negative. Squaring blocks that, so any weight far from zero costs in either direction. The weights also have to be inside the penalty term, since a bare constant has zero gradient everywhere and would do nothing at all.

This is the neural network version of adding fake counts to the bigram table. The mechanism differs and the outcome is identical: probabilities are pulled toward uniform, so nothing ends up at exactly zero. Session Two's smoothing and this session's regularization are one idea in two languages.

### How many layers this actually is

We went back and forth on this, so it is worth recording where we landed.

The one-hot input is not a layer. It is a representation choice rather than a computation, and convention does not count it. Softmax is not a layer either; it is an activation. So there is exactly one weight layer, and it is the output layer. Its twenty-seven outputs are the logits, one per character, feeding straight into softmax.

There is nothing hidden in between, which is precisely why this model can only ever capture bigram statistics. Describing it as multinomial logistic regression rather than a neural network is fair. Hidden layers arrive next session.

https://github.com/sugeesh/nuruodo_chess

## The demonstration — an agent project, and where it broke

The second half of the session was a home-lab agent project, presented as a loop rather than a list of technologies:

> Discord message → agent → custom skill → local game API → screenshot back to Discord

A browser game hosted locally with a small API for moves, a skill file teaching the agent the rules, and a screenshot endpoint so the board comes back into the Discord thread. We showed the demonstration first and explained afterwards, peeling back one layer — the skill file and the API it calls — and saving the deeper dive for questions.

The interesting part is where it broke. The build order was a local free model, then a free hosted tier, then a paid subscription. The first two could not hold the agent's system prompt plus the skill definitions plus the conversation history. The context filled almost immediately and the agent stalled.

The transferable lesson, rather than the war story, is that agent frameworks are context-hungry, and a small model is not a cheaper large model. It is a smaller room. The trade is not quality against price; it is how much the thing can hold in mind at once. That is a different axis, and it is the one that killed the first two attempts.

We kept the model names generic in the slides so that the lesson stays about context budgets rather than becoming a product comparison.

## Where this fits for AI engineering

The destination is still the application layer: building on top of existing models rather than training them.

What made this hour worth spending was not the bigram model itself, which is a toy. It was that the loop now runs end to end without a black box in the middle. The demonstration half is much closer to the actual job — an agent, a tool, an API, and a context budget that decides whether any of it works at all.

The ratio of one conceptual half to one build half is worth repeating in future sessions.


## Next session

Longer context and learned representations. We move to makemore part 2, which implements the architecture from Bengio et al. 2003: every character is given a short learned vector instead of a one-hot slot, several of those vectors are concatenated to form the context, and a hidden layer sits between the input and the output.

## Resources

- [Andrej Karpathy — _The Spelled-Out Intro to Language Modeling: Building makemore_](https://www.youtube.com/watch?v=PaCmpygFfXo) (second half)
- [makemore repository](https://github.com/karpathy/makemore)

## Slides

[[session4_neural_bigram.pdf]]

## Session

https://youtu.be/6DAu-vs3yiw