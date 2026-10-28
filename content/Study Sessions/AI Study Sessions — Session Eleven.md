---
modified: 2026-10-09
---
Date - 09/10/2026

Session Ten ended with an agent that worked: it called tools, handed work to subagents, paused for approval and ran behind a chat window. This session asked the harder question, which is how anyone can be confident it keeps working.

We followed the first half of the LangChain Academy course _Building Reliable Agents with LangSmith_. Its opening point is that prototyping an agent is the easy part, an afternoon's work, and that teams get stuck turning the prototype into something they trust in production. Everything we built in the last three sessions sits on the easy side of that line. This hour was about the other side.

## What we covered

### Why agents are harder to test than software

In ordinary software the same input gives the same output, so a test that passes today passes tomorrow. In an agent the path is chosen by the model. Which tools it calls, in what order and how many times are all decided at run time, and the same prompt can take a different route on the next run.

That changes what testing can promise. We cannot predict the agent's behaviour in advance, so we observe it, measure it and fix what we find.

> You cannot prove an agent correct. You can only watch it, measure it, and make the same mistake less likely next time.

### The agent development lifecycle

The course frames the work as a loop of four stages: build, test, deploy, monitor. Monitoring surfaces failures, they are fixed, and the loop goes round again.

The uncomfortable consequence is that an agent cannot be finished and then shipped, the way a feature can. Users will ask things nobody thought to test, so the agent has to reach real users, even if only beta users, before its real failures show up. One member asked whether this means running the tooling for the whole life of the product. It does, and the rest of the session explained why.

### LangSmith, and what it costs

LangSmith is the one paid product in the LangChain family. LangChain, LangGraph and Deep Agents are open source. LangSmith holds the traces, datasets and evaluations, and it is priced by trace volume, with a free tier for a single seat and a limited number of traces a month. A trace is roughly one conversation, so the bill grows with usage.

None of the ideas are tied to it. Langfuse is an open-source alternative that covers most of the same ground, though we have not tried it yet.

### Observability: traces instead of logs

For an agent, observability means traces. A trace records one run step by step: what the user said, which tools were called with which arguments, what came back, and what the model did next. LangChain groups the runs of one conversation into a thread.

A LangChain agent sends traces with nothing more than an environment variable set. Code written without LangChain can be traced too, by decorating functions with `@traceable` from the `langsmith` library.

### An agent without a framework

The course's example agent made that point well. It is a customer support assistant called Emma, working for an office supplies company called OfficeFlow, and it is written without LangChain at all. It uses plain Python and the OpenAI SDK. This answered a question from Session Ten about whether the loop could be written by hand.

It has two tools: one queries a SQLite database of products, and the other searches an in-memory knowledge base of company documents. The tool definitions look unfamiliar at first because they are written out in OpenAI's function-calling schema, with a name, a description and the parameters. This is what LangChain generates for us from a decorated function. Asked whether the schema is OpenAI-only, the answer was that OpenAI set the pattern and most providers now accept the same shape.

Reading the loop took two attempts. At first glance there seemed to be no loop at all, only one round of tool calls. Then it became clear that each new response replaced the previous one and was checked again for tool calls, so it kept going until the model stopped asking for tools. It was the same loop as `agent.invoke`, about twenty lines long. One view in the room was that larger companies often write their own loop for exactly this reason: it is not much code, and they want to own it.

### Reading a system prompt

Emma's system prompt had a clear shape: a role, what the agent can help with, what it cannot do (place orders, for example), a communication style, guidance on when to use each tool, and a few example exchanges.

Two questions came up. Does the Markdown in the prompt matter? Probably not much, although headings and bullets make the structure easier for the model to follow. Why describe the tools again when the schema already describes them? For a strong model it may make little difference. A smaller or older model, though, can miss a tool that is only described in its schema, so repeating it in the prompt reinforces when to reach for it. Prompt engineering in its own right is still on our list.

### Testing starts with a requirements document

Before any test can be written, someone has to say what the agent is for. The course calls this a product requirements document. It covers the agent's purpose, its tools, how it should behave, and examples that include the edge cases and the expected behaviour for each. Thinking of it as a job description helps. The useful advice was to test what matters, not what happens to be easy to run.

From the requirements document, a coding agent can draft a set of questions a customer might ask. These go into a CSV file and are uploaded to LangSmith as a dataset. Each example needs an input. A reference output is optional, and asked whether it has to follow a format, the answer was no: it is a free-form field. A real conversation can also be added from its trace with "Add to dataset", with its output edited into the reference answer.

> The dataset is the heart of it. The agent will be rebuilt many times; the dataset is what carries forward.

It starts small and rough, and it grows every time something goes wrong.

### Read the trace, fix, rerun

Manual testing is a loop of its own. The course's example asked Emma about stock levels, and the run failed inside the database tool: the model had queried a table called `inventory`, which does not exist. The trace showed exactly where. The fix went into the agent, and the question was run again.

This is why traces matter more for agents than logs do for software. In a deterministic program we can reproduce a bug and step through it. In an agent we cannot replay what a user typed and expect the same path, so the trace is often the only record of what happened. LangSmith can also open a trace in its playground to edit and rerun a step, and its CLI lets a coding agent read traces and debug the agent for us.

### Automating it: four steps

Running the dataset automatically follows four steps. First, decide what "working" means. Second, build the dataset. Third, write the evaluators. Fourth, run an experiment.

The first step is the hard one. "Working" might mean the right answer, the right tool, a cost per conversation under some figure, or a reply within a minute, and only the business can say which. The examples in the course are the obvious ones. Real agents need someone to decide.

### Code-based evaluators

The test for when to use code is a simple question: can I write a function that reliably decides this? If so, write the function.

LangSmith's `client.evaluate` takes the target (the agent), the dataset name, a list of evaluators and an experiment prefix. The dataset lives in the cloud, the agent runs on our machine, each output goes through the evaluators, and the results are written back as an experiment. Our first evaluator was trivial: does the reply mention OfficeFlow? It returned true or false, and the experiment page showed each input, output and result side by side.

Real code checks are things like format, exact matches, whether the right tool was called, and whether the agent got there in fewer than six steps. They are fast, free and deterministic.

### LLM as judge

Some questions cannot be answered by a function. Is this answer correct? Is it helpful? Is it concise? For those we ask another model. Human review answers them best, but it does not scale: twenty examples, perhaps, but not five hundred.

The course gives three rules for a judge we can rely on:

1. **Keep it narrow.** Ask one specific question. "Did the agent answer the user's question?" is checkable. "Is this a good response?" is not.
2. **Make the output binary or categorical.** A score from one to five sounds precise, but nobody can say whether 3.2 passes. Yes or no can.
3. **Align it with human labels.** This one matters most, and it gets its own section below.

One member pointed out that a judge cannot tell whether the right tool was called, because it has no access to the tools or the database. That is true, and it also would not be worth asking. If the tool name is in the trace, a line of code can check it, and a judge costs money on every call. Use code wherever code will do.

A suggestion seen elsewhere, which we have not tested: use a judge from a different provider from the agent's model, since a model may favour answers that sound like its own.

### Aligning the judge

A judge is just another model, prompted by us, with the same biases and blind spots as the agent it is grading. If its prompt misses something, every result built on it is wrong in the same way, and nothing tells us.

The fix is a loop. Take a sample from the dataset, say fifty examples, and answer the judge's question for each by hand. Run the judge over the same examples, compare its answers with ours, and wherever they disagree, find out why and refine the judge's prompt. Repeat until they agree.

> Without alignment, a judge is a rough heuristic. With it, it is an evaluator we can trust to run unsupervised.

The course's own exam questions lean heavily on this, which says something about how important the authors think it is.

### Stock leakage: a guardrail is a prompt plus an eval

The worked example tied it together. Emma was revealing exact stock quantities to customers, which the business did not want. There is no special guardrail switch for this. The fix was a policy in the system prompt saying never to reveal specific stock quantities, and to say whether an item is available instead. Behind that sat new dataset examples that ask about quantity and price, and a judge asking one narrow question: did the agent leak stock information? A code check could not catch every phrasing, so this one needs a judge.

One member objected that a prompt instruction is not that safe. That is fair, and it is why the eval exists. The prompt makes the leak less likely, and the dataset and judge check that it stays fixed every time anything else changes.

### Pairwise evaluation

The third evaluator type compares two versions of the agent rather than grading one. Run the original prompt and an updated one over the same dataset, or the same prompt on two models, and ask which does better. With a few thousand examples, one version failing two or three more cases than the other is a real signal. This took a second explanation, and that framing was the one that landed: original against updated, on the same tests.

### From testing to monitoring

Once deployed, the dataset becomes a regression suite. Every failure found in production is fixed and then added to the dataset, so the agent does not fail the same way twice. As one member put it, the test cases keep growing.

Monitoring uses the same evaluators on live traffic. A sample of real conversations is scored after they end. Since nobody announces that a conversation is over, the course treats a thread as finished after about ten minutes without a new message. A judge might then ask whether the user seemed satisfied, and poor scores can trigger alerts or reports. We left the details for next time.

Asked whether there is a pass threshold, the answer was that the dataset should pass in full. The judges themselves are never perfect, though, which is why aligning them matters so much.

The course closes on the idea that production traffic is the only real record of how people use the agent, and that the aim is fast iteration rather than perfect testing: test for the obvious failures, add guardrails, and learn from production as quickly as possible. Building the agent is the quick part. This is the part most people skip.

## Resources

- LangChain Academy — _Building Reliable Agents with LangSmith_
- LangSmith — tracing, `@traceable`, datasets, experiments, `client.evaluate`, the playground, and evaluators in the UI
- OpenAI function-calling schema for tool definitions
- Langfuse — open-source tracing and evaluation
- Chip Huyen, _AI Engineering_ — chapters three and four on evaluation, and chapter five on prompt engineering

## Slides
[[Session 11 — Building Reliable Agents with LangSmith.pdf]]

## Session
