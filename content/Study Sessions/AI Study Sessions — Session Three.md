
> [!abstract] Session summary This session covered the Karpathy's whole micrograd video. The first half builds a **computation graph** out of a plain math expression and teaches **backpropagation** over it. The second half builds a small **neural network** (Neuron → Layer → MLP) on top of that same engine. By the end I could follow the full hierarchy: **values → neurons → layers → MLP**, which is the hardest conceptual jump in the video.

## Part 1 — The computation graph & backprop

### The `Value` object (the building block)

Every single number in the graph is a `Value` object. Each one stores:

- **`data`** — the actual number from the forward pass.
- **`grad`** — the derivative ∂L∂this\frac{\partial L}{\partial \text{this}} ∂this∂L​, filled in during the backward pass (starts at 0).
- the **operation** that created it (`+`, `*`, `tanh`, …).
- **pointers to its parent nodes** — the Values that produced it.

> [!note] Why the parent pointers matter Those pointers are what let backprop **walk the graph backward**. Without them there's no trail to follow from the output back to the inputs.

### Building the graph

When I write `d = a * b + c`, I'm not just getting a number — each operation creates a **new** `Value` node that remembers _which operation made it_ and _who its parents were_. So `a * b` is a new node that knows "I was born from a multiply, my parents are `a` and `b`."

That stored operation is exactly what tells backprop **which local derivative rule** to apply later.

### Local derivatives + the chain rule

The key insight: **each node only needs its own local derivative.** No node ever needs the big picture.

|Operation|What it does to the incoming gradient|
|---|---|
|**`+` (add)**|passes the gradient straight through, unchanged|
|**`*` (multiply)**|swaps in the _other_ input|
|**`tanh`**|multiplies by 1−tanh⁡2(x)1 - \tanh^2(x) 1−tanh2(x)|

The **chain rule** then stitches all those local pieces together into the full derivative. Local rule × what came from behind = gradient at this node.

### Forward pass vs backward pass

Getting the gradient is a **two-pass** process:

1. **Forward pass** — feed inputs in, compute left → right to the final output. The graph records every operation and value. Now I have all the `data`, but **no gradients yet**.
2. **Backward pass (backprop)** — start at the very end, **seed with `grad = 1`** (∂L∂L=1\frac{\partial L}{\partial L} = 1 ∂L∂L​=1), then walk backward, applying each node's local rule × the incoming gradient. This fills in `grad` on every node.

> [!important] The "1" that seeds backprop It's `L.grad = 1` because the output's derivative _with respect to itself_ is 1. It is **not** the loss data value.

### The manual "nudge" demo (gradient descent, previewed)

Before the neural net, Karpathy does a mini-demo: run backward to get each input's gradient, then nudge every input a little in the direction of its gradient — and the output goes **up**, just as the gradients predicted.

The update rule for each input:

new data=old data+(step size×grad)\text{new data} = \text{old data} + (\text{step size} \times \text{grad})new data=old data+(step size×grad)

> [!tip] Why multiply by the gradient instead of just using its sign?
> 
> - **Size matters, not just direction** — a big gradient means a strong effect, so that input moves more.
> - **The sign falls out automatically** — a negative grad makes the term negative, so the input goes _down_ on its own. I never have to reason about signs; the math handles direction _and_ strength in one move.

This is the whole idea of learning in miniature: **gradient tells direction, small step moves you that way.** (In real training we step in the _opposite_ direction to make loss go _down_ — that's gradient descent.)

---

## Part 2 — From one neuron to a network

### The neuron (a.k.a. perceptron)

A single artificial neuron:

y=tanh⁡ ⁣(∑iwixi+b)y = \tanh\!\left(\sum_i w_i x_i + b\right)y=tanh(i∑​wi​xi​+b)

- multiply each input by its **weight**
- sum them all
- add a **bias**
- squash through an **activation** (`tanh`)

> [!note] How many Values does a neuron hold? **One weight per input, plus exactly one bias.** So a neuron with 3 inputs holds **4 Values** (3 weights + 1 bias); with 2 inputs, **3 Values**. Not just one.

Inside, the neuron builds the _same_ multiply-then-add graph from Part 1 — w1x1+w2x2+⋯+bw_1x_1 + w_2x_2 + \dots + b w1​x1​+w2​x2​+⋯+b — feeding into a final `tanh` node. Same building blocks I already know.

> [!info] `Value` vs `Neuron` — two different levels `Value` = the low-level graph node (each weight, each intermediate result). `Neuron` = a **container** that _owns_ a bundle of Values (its weights + bias). The neuron doesn't replace Value; it holds a handful of them.

### Activation functions

`tanh` squashes to [−1,1][-1, 1] [−1,1]; `sigmoid` squashes to [0,1][0, 1] [0,1]. But **squashing the range isn't the real reason** we use them.

> [!important] The real job: non-linearity Without an activation, stacking layers is pointless — a chain of linear steps collapses into **one** linear step, so the network can only draw straight lines. The activation adds a **bend** at each layer, and _that's_ what lets the network learn curves and complicated shapes.
> 
> For following the video, "it squashes into a range" is a fine working description — just keep the footnote that the deeper purpose is the bend.

### The three classes: Neuron → Layer → MLP

Boxes inside boxes. Each class has the **same three methods**.

**Neuron**

- **constructor** — creates its weights + bias as random Values.
- **`__call__`** — takes inputs, does w⋅x+bw \cdot x + b w⋅x+b then `tanh`, returns the result.
- **`parameters()`** — returns its weights + bias in one list.

**Layer** = a row of neurons side by side.

- **constructor** — you say _how many inputs_ and _how many neurons_; it builds them.
- **`__call__`** — feeds the **same inputs** to every neuron, collects each neuron's one output into a list. → _5 neurons ⇒ 5 outputs._
- **`parameters()`** — gathers weights + biases from all its neurons.

**MLP** (Multi-Layer Perceptron) = a stack of layers in a row.

- **constructor** — you give the sizes; it builds all the layers.
- **`__call__`** — passes inputs through each layer in turn; **one layer's outputs become the next layer's inputs**; the last layer's output is the final answer.
- **`parameters()`** — gathers every weight + bias from every layer.

> [!summary] The hierarchy **MLP is a list of layers · Layer is a list of neurons · Neuron is a bundle of Values.** The outputs of one layer feed the next, all the way through.

### `__call__` — the Python trick that makes it elegant

`__call__` is a real built-in Python **dunder** (double-underscore) method, not something Karpathy invented. Defining it makes an instance **callable** like a function:

python

```python
n = Neuron(2)
out = n(x)        # secretly runs n.__call__(x)
```

Because of this, a Layer can call each neuron with `neuron(x)`, and the MLP can call each layer the same way. Everything becomes callable, so the code reads like data flowing through a chain of functions — **calls inside calls**, a manager passing work down to each worker.

### `parameters()` — why it exists

During training I need to grab **every** weight and bias so I can nudge each one. `parameters()` is the convenient "give me everything I'm allowed to tune" list, gathered up the hierarchy (neuron → layer → MLP).