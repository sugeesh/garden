---
modified: 2026-10-05
---
Date - 05/10/2026

Session Nine ended with one server driven by two clients, and a list of questions about what happens inside the agent once its tools are real. This session went inside.

The loop itself was not new. What was new was everything around it: what the agent knows that the model does not, what it is allowed to change while it runs, how it hands work to other agents, and where we can step into the loop to trim it, summarise it or stop it. Most of it was shown in a notebook rather than on slides, so the message history was on screen for most of the hour. That turned out to be the right thing to stare at.

## What we covered

### The loop, once more

With a new face in the room, we restated the picture. The model is the brain. The agent is the application around it, with tools that can do things. Claude Code is the familiar example: it has file system and shell tools, it asks the model what to do next, it runs whatever the model asks for, and it goes round again.

The first question was whether that loop happens on its own. It does: `agent.invoke` runs it. It sends the messages, runs any tool calls in the reply, appends the results and sends again, stopping when the model answers in plain text. Written by hand it is a short while loop. The framework saves us writing it, not understanding it.

The second was whether the message format is a standard. It is not. `HumanMessage`, `AIMessage` and `ToolMessage` are LangChain's own classes, wrapping the roles each provider uses, such as OpenAI's `user` and `assistant`. There is a common shape across providers, but LangChain's classes are a convenience layer over it.

### Context the model never sees

Runtime context is a dataclass passed in when the agent is invoked. We set a favourite colour in it and asked the agent what our favourite colour was. It said it did not know.

That was the point of the demonstration. The only things that go to the model are the messages and the tool definitions. The context lives in the application's memory, and nothing carries it across.

The fix was two small tools that read the values from `runtime.context`. Run again, the history told the whole story: an AI message with empty content and a tool call, a tool message carrying "blue", then the final answer.

> The model only sees messages and tool definitions. Anything else has to reach it through one or the other.

Context is fixed for the run. The agent can read it but cannot change it, which suits things such as a user ID or a subscription tier.

### State the agent can change

State is the mutable version. We subclassed `AgentState`, which already holds the message history, added a favourite colour field and wrote a tool to update it. Telling the agent our favourite colour was green made it call that tool.

Asking for it back needed a second tool, to read the state. The agent cannot touch its own memory without one. Every read and every write is a tool.

There was a quieter lesson in the demo too. The colour was already sitting in the message history, so the model could have answered without any state at all. State earns its place when the history cannot be trusted to hold a value, which is exactly what the middleware section went on to do to the history.

### Subagents are tools

The smallest example used two agents, each built with `create_agent` and given one tool: one finds square roots, the other squares. Each was wrapped in an ordinary tool whose description says what it does, and the main agent was given only those two wrappers.

From the main agent's side there is nothing special. It sees two tool descriptions, picks one, and gets a result back. It never sees the subagent's own tool or its loop. Asked for the square root of 456, it called the first wrapper, which ran a whole agent loop of its own and returned roughly 21. It was noticeably slower, because there were now two loops.

One member asked whether this was like threads. It is not, at least not in the operating system sense. It is a division of work inside the program, where each subagent has its own prompt, its own tools and its own loop. Claude Code does the same thing when it splits a large task, sending the UI to one subagent and the backend to another, sometimes in parallel.

> A subagent is a tool whose implementation happens to be another agent.

### The wedding planner

The larger example was an assignment from the LangChain Academy course. A coordinator agent plans a wedding using three specialists. The flight agent uses the Kiwi.com MCP server for flight search, the venue agent uses web search, and the playlist agent queries a SQLite database of artists and tracks. Each has its own system prompt about its one job. A shared state holds the origin, destination, guest count and music genre, and the coordinator updates it as answers come in.

We asked for a wedding in Singapore for a hundred guests travelling from Sri Lanka, with jazz. It took a long time, since every specialist ran its own loop and the flight agent was making MCP calls, but it came back with a full plan.

A single agent with all of those tools could do the same job. The reason to split it is that the flight agent never needs the music database and the playlist agent never needs flight search. Each specialist sees only what it needs. Our subagents were also fixed when the code was written, whereas harnesses like Claude Code create them on demand.

### Middleware: hooks around the loop

Middleware is how LangChain lets us step into the loop without rewriting it. There are six places to hook in. `before_agent` and `after_agent` run once per invocation. `before_model` and `after_model` run on every lap, either side of the model call. `wrap_model_call` and `wrap_tool_call` wrap the model call and each tool call. We can use the built-in middleware or write our own.

### Summarisation, and why the history grows

Every call to the model sends the whole history. A "hi, how are you" at the start of a conversation is sent again with every later question, along with every tool call and result. The history grows on every turn until it presses against the model's context window. The model documentation we looked at lists that window in tokens, and larger models get larger windows.

`SummarizationMiddleware` handles this. It takes a model, a token count that triggers it, and how many recent messages to keep. With the trigger set deliberately low, the history collapsed into a single message beginning "Here is a summary of the conversation", and that summary was carried forward on the thread from then on. It is the same thing Claude Code does when it compacts a long session, and it is why answers afterwards can feel less sharp: the summary keeps the gist and drops the detail.

The follow-up question was how it is triggered, given that it runs before the model yet uses a model itself. Both are true. It is a `before_model` hook, so it checks the history before every model call, and when the history is over the threshold it makes a separate model call to write the summary. Summarisation is not free.

### Writing our own: trimming tool traffic

The custom example did something cruder. A hook read the messages from the agent's state and removed the tool traffic, meaning both the model's requests to call a tool and the results that came back, using `RemoveMessage`. Once the model has turned a tool result into an answer, the request and the result have done their job. Run again, the history read human, AI, human, AI, with no tool messages in between.

The two have to go together. Providers expect every tool call to be followed by its result, so removing one without the other would break the next request.

### Human in the loop

The middleware that matters most is the one that stops the agent. `HumanInTheLoopMiddleware` takes a map of tool names. We set `send_email` to interrupt with the description "tool execution requires approval", and left `read_email` to run freely. A question settled one detail: tools that never pause do not need to be listed at all.

We passed an email in through state and asked the agent to read it and reply. There was no final answer. The result carried an `__interrupt__` entry instead, holding the action the agent wanted to take: the `send_email` call with its drafted body, the description, and a review config listing the allowed decisions of approve, edit, reject and respond.

Resuming meant invoking the agent again on the same thread ID with `Command(resume={"decisions": [{"type": "approve"}]})`. The run picked up where it stopped, sent the email, and the last message confirmed the reply was sent. `Command` is LangGraph's standard way to resume. A real application would show the interrupt as buttons and send the `Command` back when one is pressed.

> The pause is not a blocked thread. The run stops, its state is saved against the thread ID, and resuming is just another invoke.

The approval sits after the model and before the tool. The model has already decided what it wants to do, and the human decides whether it happens.

### From notebook to a running agent

Notebooks are good for this kind of walkthrough, but an application needs a file. The code that builds the agent moved into a Python module, with a function that returns the agent. A small `langgraph.json` says where to find it, and `langgraph dev` from the LangGraph CLI starts a local server around it.

That server connects to LangSmith Studio in the browser. The browser asked first whether the page could reach a service on the local network, which is worth noticing, since a hosted page is talking to a port on our machine. Studio drew the run step by step: model, web search tool, model again. One member asked where the web search tool had been configured. It had not been configured anywhere new. It was the agent's own tool, and `langgraph dev` only serves the agent the config file points to.

Studio is not open source. Agent Chat UI is, and it is the one to show a client. Pointed at the local server with the graph ID `agent` and no LangSmith key, it gave us a plain chat window. Tool calls can be shown or hidden.

The human-in-the-loop agent behaved well there, too. Asked to reply to an email, it paused and the chat window showed an approval card with approve, edit and reject. Getting there needed a workaround, though. In the notebook the email was passed in as state at invoke time, but a chat window has no way to do that, so the inbox arrived empty. We added a `load_emails` tool and a line in the system prompt telling the agent to always load emails before reading them. Without that line, the agent listed everything it could do and asked what we wanted.

> Anything you pass in at invoke time has no way in through a chat window. If the agent needs it, it has to come through a message or a tool.

## Resources

- LangChain documentation — `create_agent`, runtime context and state, middleware
- `SummarizationMiddleware` and `HumanInTheLoopMiddleware`, and `Command` from `langgraph.types`
- LangGraph CLI — `langgraph dev` with a `langgraph.json` config
- LangSmith Studio
- Agent Chat UI — `langchain-ai/agent-chat-ui`
- LangChain Academy — the multi-agent wedding planner, with the Kiwi.com MCP server
- Deep Agents — `deepagents`

