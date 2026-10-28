---
modified: 2026-10-13
---
Date - 13/10/2026

Session Eleven covered the test stage of the agent development lifecycle: datasets, evaluators, and judges aligned against human labels. It ended on the point that production traffic is the only real record of how people use an agent. This session went there.

Deployment is a topic of its own and is still to come. This hour skipped ahead to monitoring, the stage that feeds everything back into the loop. We worked mostly in LangSmith on traces from our own earlier projects, so the numbers on screen were real ones, if small.

## What we covered

### Four things to monitor

Monitoring an agent breaks down into four questions:

- **Cost:** what we are spending, and whether it is within budget.
- **Product analytics:** what people are actually using the agent for. Picture an internal agent that answers HR questions. At the end of the month we want to know which categories of question came up most, without reading every conversation.
- **Quality:** whether it is working as intended.
- **Security:** whether anything is happening that should not be, such as prompt injection.

We covered cost and quality in depth, looked briefly at analytics, and left security for later.

### Where cost comes from

Open a trace in LangSmith and the cost sits next to the token counts. One short run showed about 1,800 input tokens and 23 output tokens, with the cost of each and the total. In a longer trace, every model call carries its own cost, and the tool calls carry none. The waterfall view lines the steps up in time.

The calculation is simple. Every model response comes back with metadata that includes the input and output token counts. We saw this in the very first session, when we called the model directly and printed the response. LangSmith multiplies those counts by the price for that model, and input and output tokens are priced differently.

The prices live in a model pricing table in the settings, quoted per million tokens. The contrast was the most memorable thing on screen. The most expensive model in the table charged tens of dollars per million tokens. GPT-5 nano, the model behind most of our demos, charged a few cents per million input tokens and well under a dollar per million output tokens. The same agent can cost a hundred times more depending on one line of configuration.

> Cost is tokens times price, and the trace already knows the tokens. The only thing that can be wrong is the price.

Someone asked whether the table covers video models such as ByteDance's Seedance or Google's Veo. It did not. The table holds the popular text and image models, but any model can be added with a name, input and output prices, the date the price takes effect, the provider, and a match pattern. The match pattern is a regular expression on the model name, not on the response. Existing entries can also be overridden, which matters for larger organisations that negotiate their own rates with a provider.

Providers that follow the OpenAI API format work out of the box. Others need two pieces of metadata in the code, `ls_model_name` and `ls_provider`, or the token counts set on the run by hand.

### Tools cost money too

A tool that queries a local SQLite table is free. One that calls a paid search API such as Tavily, or an MCP server sitting in front of a paid service, is not, and LangSmith cannot know what it costs. The fix is to set the cost inside the tool itself. We fetch the current run with `get_current_run_tree()` and put the price into its usage metadata. From then on the tool's cost appears in the trace and the totals alongside the model's.

### Prompt caching

The model is stateless. Every call sends the whole conversation again: the system prompt, the tool definitions, every earlier turn, and then the new message. Without help, the provider would process all of it from scratch every time.

Prompt caching is that help. The start of each request is identical to the previous one, so the provider keeps the work it already did on that prefix for a short time, a few minutes with the major providers. The next request then processes only the new message. The example we looked at had a system prompt, tools and skills totalling about 5,200 tokens, followed by a three-token "good morning". On the second message, those 5,203 tokens were read from the cache at roughly a tenth of the normal price, and only the three new tokens cost the full rate. Over a long conversation, the cost curves with and without caching diverge sharply.

Most providers do this automatically. Anthropic needs a flag, which agent harnesses usually set for us. With a new or less familiar provider, it is worth checking whether caching is on, given how much it saves. The pricing table includes a separate, lower price for cached reads.

> The cache only helps while the prefix stays the same. Change anything near the start of the conversation and the next call pays full price for all of it.

### Three places to see cost

There are three places to look. The trace tree shows the cost of a single run. The project stats show the total for a project; ours had spent well under a dollar across its entire history. The monitoring dashboard shows traces, latency and cost per trace over time, and that is the view that matters in production.

### Reading a spike

The dashboard made the most useful demonstration of the session. Over two days, the cost chart was flat apart from one spike. It plots percentiles: p50 is the value half the traces fall under, and p99 is the value all but the most expensive one per cent fall under. The spike showed up clearly at p99.

Clicking the spike opened the traces from that moment, much like jumping from a graph to the server logs at the same time. We compared one of them with an ordinary trace. Both used about 1,700 tokens, but the ordinary one cost about two tenths of a cent while the spike cost close to nine cents. The difference was the model: the spike had run on GPT-5 mini, and the usual traffic on GPT-5 nano.

> A spike on a chart is a question. The trace is where the answer is.

### Monitoring quality: errors and latency

Quality has three parts: errors and latency, user sentiment, and A/B testing. We started with the one that looks most like ordinary operations.

LangSmith can raise alerts on traces. An alert on errors fires when, for example, one or more traces fail within a five-minute window. That covers a failing tool, a failing model call or an unhandled edge case. The alert goes out through a webhook, for example to create a ticket in an issue tracker, and there is a direct Slack integration. A latency alert works the same way, firing when average latency over the last five minutes passes a threshold, and it can be sent to Datadog.

The split of responsibilities is worth keeping. LangSmith sees the agent: which run failed and why. An APM tool such as Datadog sees the infrastructure: which service is slow. An alert should link back to the trace that caused it, and from there a coding agent connected through the LangSmith SDK can be pointed at the trace to work out what went wrong.

### User sentiment: thumbs and threads

The simplest signal is the thumbs up or down most chat products ask for at the end of a conversation. The LangSmith SDK records it with `client.create_feedback`, under a key such as `user_sentiment`. The advice from the last session applies again here: make it binary. A two out of five tells us nothing we can act on.

Most users never press either button, though, which is where online evaluation comes in. It is the same kind of evaluator as in the testing stage, but it runs on live traffic, and for sentiment it has to run on a whole thread rather than a single turn. One reply rarely tells us whether the conversation went well. The arc of the conversation does: whether the user ended up frustrated or saying thank you. Single-turn evaluators still suit narrower jobs, such as format checks or safety checks on each message.

A thread-based evaluator runs once a thread goes idle, about ten minutes after the last message, since nobody announces that they have finished. It uses an LLM judge, so every evaluation costs money, and the main setting is sampling. Scoring every thread is rarely affordable, so we would start at a random 30 to 40 per cent, perhaps with a cap on the number of threads. The judge only needs the human and AI messages, not the tool calls, and the user's final message carries the most weight. LangSmith ships a user satisfaction template for this, a prompt that reads the full conversation and returns true or false.

Acting on the result closes the loop from Session Eleven. A thread that scores badly goes into an annotation queue. Someone reviews it, and if it is a genuine failure it becomes a new example in the test dataset. Scheduled reports can summarise the trend.

### A/B testing

To compare two versions of the agent on real users, with a new prompt or a different model, we deploy both and tag each trace with the variant, for example a prompt version in the trace metadata. The dashboard can then group cost, latency and sentiment by that metadata, so the two versions sit side by side. We did not have a project set up this way to show, so this part stayed on the slide.

### Product analytics

LangSmith can also read across traces and produce an insights report that groups conversations into categories. The sample report we looked at sorted them under headings such as agent behaviour failures and data integration. It answers the HR question from the start of the session. It sits on a paid plan, so we only looked at an example.

## Resources

- LangChain Academy — _Building Reliable Agents with LangSmith_, the monitoring modules on cost and quality
- LangSmith — the model pricing table, `ls_model_name` and `ls_provider`, `get_current_run_tree()`, alerts and webhooks, the monitoring dashboard, `client.create_feedback`, online evaluators and the user satisfaction template, annotation queues, and insights
- Provider documentation on prompt caching
- Datadog APM, for infrastructure alongside agent traces

## Slides
[[Session 12 — Production Monitoring for AI Agents.pdf]]

## Session
