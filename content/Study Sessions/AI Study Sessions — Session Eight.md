Date - 15/09/2026

The plan for this session was hybrid search fusion in the first half and the LangChain agent module in the second.

We changed it before we started, and dropped the first half entirely. The reason was the same one that keeps coming up: the group had arrived at agents through a retrieval pipeline, but nobody had been shown the vocabulary that agent code is written in. Going straight to an agent that calls a retriever would have meant explaining chat models, messages, tools and the agent loop in passing, while also explaining fusion ranking. Something had to give, and fusion is the part that can wait without blocking anything else.

So this session was foundations: the LangChain basics, then the agentic basics on top of them.

## What we covered

### The LangChain basics

The library is smaller than it looks once the vocabulary is in place. A chat model is a wrapper around a provider's API with a common interface, so the same code runs against different providers. A message is the unit of conversation. A tool is a function the model may ask to run. An agent is the loop that keeps calling the model until it stops asking for tools.

Everything else is convenience around those four ideas.

### Messages and roles

Messages are where most of the early confusion lives, because there are two ways to write the same thing. A role string and a message class produce the same object: `"user"` or `"human"` becomes a `HumanMessage`, `"assistant"` or `"ai"` becomes an `AIMessage`, `"system"` becomes a `SystemMessage`, and a tool result becomes a `ToolMessage`.

The strings are quicker to type; the classes are explicit and they are what comes back out of the model, so reading code means knowing both.

> A `ToolMessage` must carry the `tool_call_id` of the call it answers. Without it the provider rejects the history, because it cannot tell which request the result belongs to.

That one requirement explains a lot of otherwise confusing errors. The conversation sent to a provider is not a list of turns; it is a structure where every tool result points back at the request that produced it.

### LangChain and LangGraph

LangChain is the toolkit: model wrappers, tools, messages, and simple chains where one step feeds the next. LangGraph sits on top for flows that are not a straight line — nodes and edges, with loops and branches and conditional routing.

The practical split: a straight pipeline is a chain, and anything that has to decide whether to go round again is a graph.

### Agents and workflows are not the same thing

This was the distinction the second half was built on, and it is worth stating carefully because the industry uses both words loosely.

A workflow is a sequence somebody coded. The steps are fixed, the order is fixed, and no model chooses what happens next — a model might do the work inside a step, but it does not pick the step. An agent chooses its own next action. Given a goal and a set of tools, it decides what to call, looks at the result, and decides again.

Neither is better. A workflow is predictable and cheap to reason about; an agent handles cases nobody enumerated in advance. Most real systems are a workflow with one or two agentic steps inside it, and LangGraph can express both in the same graph.

### An agent versus an agentic system

The same distinction scales up, and the diagram we worked through makes it concrete.

A single agent is one loop. A goal goes in, and an agent core holding the model, its instructions and its task state decides, acts, observes, updates its state, and eventually produces an outcome. Control lives inside the model: the loop continues because the model keeps asking for another tool call.

An agentic system is an architecture. An objective goes to an orchestration layer, which dispatches work to several agents and workflows, evaluates the progress that comes back, and re-plans if the objective is not met. Control lives in that orchestration layer rather than in any one model. State is shared between components rather than private to one loop, and evaluation is a dedicated step rather than something the model does implicitly on its own output.

> An agent is a component. An agentic system is a shape you build out of components.

A thing that is mostly missing from both descriptions, and worth flagging: whichever shape you build, the output is produced by a probabilistic system exploring a space no human enumerated, so verification at the end is not optional.

## Open questions to follow up

- Where the boundary actually sits between a complicated workflow and a simple agentic system
- Whether the orchestration layer should itself be a model, and what that costs in predictability
- How tool descriptions should be written, given that they are the only thing the model sees when choosing
- What guardrails belong at the input side versus the output side, which is the topic we keep pushing forward

## Next session

The Model Context Protocol, thoroughly: what it is, what problem it solves, how a client and a server actually talk, and a live demo of one server driven by two different clients.

If there is time after that, the agent runtime topics that follow naturally from the basics covered here — context and state, managing message history, and a human approval step in the loop.

## Resources

- LangChain documentation — chat models, messages, tools, `create_agent`
- LangGraph documentation — nodes, edges, conditional routing
- Chip Huyen — *AI Engineering*, chapter six on agents, with the tool description and prompt injection material from chapter five

## Slides

## Session
