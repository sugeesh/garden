Date - 22/09/2026

Session Eight ended with agents that call tools, and tools that are Python functions living inside the agent's own process.

This session was about what happens when the tool stops being a function and becomes a service. The Model Context Protocol is the current answer to that, and it has enough moving parts — two transports, two sets of primitives, an authorization model — that it deserved a whole hour rather than a mention.

The demonstration was built around a single claim: the same server, unchanged, driven by two completely different clients.

## What we covered

### The problem it claims to solve

The usual pitch is the N×M problem. Five clients that each need ten tools means fifty integrations; a shared protocol turns that into ten servers plus five clients, which is fifteen.

The room pushed back on this, usefully. Before MCP you would have wrapped a vendor's SDK in a tool function once and reused it, so the fifty is not obviously real. Two things survive that objection. First, the arithmetic only pays off if the clients have actually adopted the protocol — and they have, which is why Claude Code, Cursor, VS Code and LangChain can all consume the same server. Second, an SDK is language-bound. A Python SDK is no use to a TypeScript agent, whereas a server is a process, and anything that speaks the protocol can talk to it.

> If you are the only client you will write a wrapper either way. The win needs a shared server.

### Hosts, clients and servers

Three words, easy to conflate. The host is the application. The client is the piece inside it that maintains one connection to one server. The server exposes the capabilities.

The step people miss is that the model never talks to the server. The client lists the available tools and passes their definitions to the model with the prompt; the model can only *ask* for a call; the client checks permission and performs it, then returns the result. Every round trip goes through the client.

Six steps, in order: launch, `initialize` handshake, `tools/list` discovery, tool definitions into the prompt, `tools/call` on request, then close. The same six happen inside a LangChain `MultiServerMCPClient`.

### What a server can expose, and what a client can offer back

Servers expose three things, and the distinction between them is about who decides. Tools are model-decided. Resources are application-decided. Prompts are user-decided — the slash commands and templates a person picks deliberately.

Clients can expose two things back, which is the half most people never see. Roots declare which directories the server should consider in scope, a convention rather than a sandbox. Sampling lets the server borrow the client's model rather than carrying its own API key. The June 2025 specification added elicitation, where a server pauses mid-call to ask the user a structured question.

### The two transports

stdio means the client launches the server as a local subprocess and talks to it over stdin and stdout. One user, no authentication, no network. Streamable HTTP means the server is already running somewhere as a real endpoint, serving many users at once, with OAuth in front of it.

The older SSE transport is deprecated. It needed two endpoints; the replacement uses one, where the server answers a normal POST either with a single JSON reply or by upgrading to a stream, with an optional session header and the ability to resume from the last event seen. One member's framing, which stuck: the single reply is a `Mono`, the stream is a `Flux` — though it is a wire format, so there is no backpressure in it.

The rule of thumb: if it touches your machine, stdio; if it is shared or hosted, HTTP.

> With stdio you own the process. With HTTP you are a client of somebody else's server.

Everything else follows from that sentence. Your stdio server lives exactly as long as your session and fails in local ways — wrong path, missing dependency. A hosted server runs for weeks, fails in network ways, and can be taken down by somebody else's deploy.

### A stdio config is a terminal command

Worth slowing down on, because the config format hides it. The `command` and `args` in a client's configuration are the command you would type to start the program, nothing more. It becomes an MCP server the moment it speaks the protocol on stdin and stdout, and the configuration has no idea whether the program is Node, Python or a binary.

Three consequences. The client spawns the process directly rather than through a shell, so `args` is a list and there are no pipes, wildcards or variable expansions. Run the same command by hand and it does not print help and exit — it blocks, waiting for JSON-RPC on stdin. And the working directory is the client's, not yours, which matters for any tool that resolves a project from where it was launched.

### Reaching an application that is already running

A stdio server can start a program, but it cannot reach inside one that is already open. A running process is closed from the outside unless it has deliberately opened a door.

That is why the Blender integration needs an addon. The addon runs inside Blender, where it can see the scene, and listens on a local socket. The MCP server connects out to that socket and forwards calls to it. The protocol only lives on the outer hop; the inner channel is whatever private JSON the addon author invented. The ordering matters — the application with its addon has to be running before the server tries to connect, or the connection is refused.

The same pattern covers any application with a scripting hook, a local API or a usable command line. You do not need to have written the application; you need a door.

### The demonstration

We registered the Playwright MCP server with Claude Code and asked it to open a news site and report the top three headlines. A real browser opened on screen and drove itself.

Then the same server, launched with the same command, driven by a LangChain agent instead — a `MultiServerMCPClient` over stdio, an explicit session so the browser survives between calls, and the tool calls printed as they happened. Same server, different client, no changes to either side.

Two things worth saying aloud while it runs. The processes are local — the host, the server subprocess it spawned, and the browser that server launched — but the thinking is not: the prompt and every tool result, which is a text snapshot of the page, go to the model in the cloud. And the browser is not your browser. Playwright keeps its own dedicated profile, so the agent gets a sandbox by default and reaching your real Chrome is something you opt into with a flag.

### Two trust models

The local case and the remote case ask for completely different things. A stdio server has no authentication at all — you trust the process, because you launched it on your own machine with your own permissions.

A remote server cannot work that way. Under the 2025-06-18 specification an MCP server is an OAuth 2.1 resource server only: it consumes tokens and never issues them. It must publish protected resource metadata so a client can discover which authorization server to use, and the client must bind its token to that specific server, so a token stolen from one is useless at another.

Local: trust the process. Remote: trust the scoped token.

## Open questions to follow up

- What a consent screen and a scoped token actually look like in practice, which needs a hosted server to demonstrate
- Whether to build our own server for the retrieval endpoint, and what its tool descriptions should say
- How permission prompts should work when an agent runs unattended
- What happens to the agent's message history across a long tool-calling session, which is the context-management thread we have not opened yet

## Next session

The runtime topics that follow from having an agent that calls real tools: context and state, managing message history as it grows, and a human approval step in the loop.

An authorization demonstration against a hosted server is the other candidate, using the same prompt with a read-only token and then a write-capable one, so the failure is visible rather than described.

## Resources

- Model Context Protocol specification, version 2025-06-18, including the authorization section
- RFC 9728 — OAuth 2.0 Protected Resource Metadata, and RFC 8707 — Resource Indicators
- Playwright MCP server — `npx @playwright/mcp@latest`
- LangChain MCP adapters — `MultiServerMCPClient`, `load_mcp_tools`

## Slides
[[Session 9 — MCP One Protocol, Many Clients.pdf]]

## Session
