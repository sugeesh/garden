---
modified: 2026-11-17
---
Nov 17, 2026 
## Why Spec-Driven Development

For decades, the code was the application. Documents guided us toward the right code, but fell out of date in the long run, while the code never lied. Change meant editing code first and patching the paperwork later.

With the use of coding agents, a new problem has come up, the agent produces exactly what it is asked for, so a mistake in the prompt goes straight into the code. This makes the code unreliable, which usually creates uncertainty throughout the project. To trace mistakes back to their source, prompts need to be stored and versioned alongside the code they produce.

Spec-driven development (SDD) offers a solution to this problem. In SDD, we consider the specification the source of truth and generate the code from it. A precise spec is written and reviewed first, a technical plan is derived from it, and the code is generated to satisfy both. When a behaviour change is needed, we should change the spec and regenerate the code, not change the code directly without going through the spec.

Spec Kit is GitHub’s open-source toolkit for SDD. It supports almost all popular coding agents. It supplies the document templates, a fixed command sequence inside Claude Code, and checks that the spec, plan, tasks and code agree with each other. It does not replace engineering judgment: every document it produces is a draft we need to review.

This article is based on "Johan Smarius" talk in "NDC Copenhagen 2026" on ["Is Spec Kit the future for software development"](https://www.youtube.com/watch?v=C0H-_zdfXIc)

|  | Code-first | Spec-driven with Spec Kit |
| --- | --- | --- |
| Source of truth | The code | The spec and plan |
| Documents | Written after, often stale | Written first, kept current by the workflow |
| Changing behavior | Edit code, then maybe the docs | Change the spec, regenerate |
| What a reviewer reads | The diff | The spec, then the diff |
| Agent's input | A chat prompt | Constitution, spec, plan, tasks |

## Core rules

![[spec-kit-3.png]]
*From [Johan Smarius - NDC Copenhagen 2026](https://www.youtube.com/watch?v=C0H-_zdfXIc)*

1. **No code before an approved spec.** The spec says what and why. It never names a framework, a table or an endpoint.
2. **We own every gate.** Claude drafts the spec, plan and tasks. We read, correct and approve each one before running the next command.
3. **Fix the document, not the code.** When the output is wrong, correct the spec or plan and regenerate. Hand-patching code makes the spec a lie.


## Setup

Setup is two terminal commands, then we work inside Claude Code. We need Python 3.11+, [uv](https://docs.astral.sh/uv/), Git and Claude Code installed.

```bash
# 1. Install the CLI, pinned to a release tag
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v1.4.1

# 2a. New project
specify init url-shortner --integration claude
cd url-shortner

# 2b. Or an existing repository, from its root
specify init --here --integration claude

# 3. Start Claude Code in the project directory
claude
```

Everyone on the team uses the same tag, because command names and file locations have changed between releases.

`specify init` writes three things into the repository. Commit all of them.

| Path                        | What it holds                                           | Who edits it                                               |
| --------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `.specify/`                 | Templates, helper scripts, and `memory/constitution.md` | We edit the constitution; leave scripts alone              |
| `.claude/skills/speckit-*/` | One skill per workflow command                          | Nobody; upgraded with `specify integration upgrade claude` |
| `CLAUDE.md`                 | Project context Claude Code reads on every session      | We, as the project grows                                   |

## Project structure


```text
helpline-assistant-project/
|
├── .claude/
│   └── skills/
│       ├── speckit-constitution/
│       ├── speckit-specify/
│       ├── speckit-clarify/
│       ├── speckit-plan/
│       ├── speckit-checklist/
│       ├── speckit-tasks/
│       ├── speckit-analyze/
│       ├── speckit-implement/
│       ├── speckit-converge/
│       └── speckit-taskstoissues/
├── .specify/
│   ├── memory/
│   │   └── constitution.md          ONCE per project, applies to every feature
│   ├── templates/                   spec, plan, tasks templates (override here)
│   ├── scripts/
│   └── feature.json                 points at the active feature (git-ignored)
├── specs/                           ONE folder per feature
│   ├── 001-tenant-auth/
│   │   ├── spec.md                  from /speckit-specify and /speckit-clarify
│   │   ├── plan.md                  from /speckit-plan
│   │   ├── research.md
│   │   ├── data-model.md
│   │   ├── quickstart.md
│   │   ├── contracts/
│   │   │   └── openapi.yaml
│   │   ├── checklists/
│   │   │   └── requirements.md
│   │   └── tasks.md                 from /speckit-tasks, ticked by /speckit-implement
│   ├── 002-ticket-api/
│   │   └── (same files)
│   └── 003-ai-triage/
│       └── (same files)
├── src/                             application code
├── tests/
├── migrations/
└── docs/
    └── architecture.md              living description of the whole system
```

## The workflow

Every feature runs the same nine commands in the same order, and we stop to review after each one. The constitution is written once per project; the rest repeat per feature.

![[spec-kit-1.png]]

Implement and Converge repeat until Converge finds no gaps; only then does the feature go to review. The optional Checklist command sits between Plan and Tasks.

![[spec-kit-2.png]]


The same sequence, grouped the way we will remember it: write, design, build and check, with  review after every command.

| #   | Command                 | We give it                                      | It writes                                                                | We review before moving on                                       |
| --- | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 0   | `/speckit-constitution` | Non-negotiable engineering rules                | `.specify/memory/constitution.md`                                        | Every rule is testable, none is a wish                           |
| 1   | `/speckit-specify`      | What the feature does and why, no tech          | `specs/NNN-name/spec.md`                                                 | User stories, requirements and success criteria match our intent |
| 2   | `/speckit-clarify`      | Answers to its questions                        | Updates `spec.md`                                                        | No open `[NEEDS CLARIFICATION]` markers remain                   |
| 3   | `/speckit-plan`         | Stack, architecture, constraints                | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | Data model and API contracts and plan                            |
| 4   | `/speckit-checklist`    | A focus area, such as security                  | A checklist under `checklists/`                                          | Every item ticked or consciously waived                          |
| 5   | `/speckit-tasks`        | Nothing, or a note such as "include test tasks" | `tasks.md`                                                               | Order is sane, each task names a file, tests exist               |
| 6   | `/speckit-analyze`      | Nothing                                         | A read-only report                                                       | Zero CRITICAL findings                                           |
| 7   | `/speckit-implement`    | Nothing, or a phase to stop at                  | Code, and `[X]` marks in `tasks.md`                                      | Tests pass locally; we read the diff                             |
| 8   | `/speckit-converge`     | Nothing                                         | New tasks for any gap, or a `Converged` verdict                          | Repeat 7 and 8 until `Converged`                                 |

Steps 2, 4 and 6 are optional in the tool.  ( Additionally , `/speckit-taskstoissues`, turns `tasks.md` into GitHub issues )

Better to start a fresh Claude Code session (or `/clear`) between plan and implement on large features. The files carry all the context, so nothing is lost and the model works with a clean window.


## Example : Url Shortner

Application is a URL shortener. Users sign in, paste a long web address and get a short link that anyone can open. Links can expire, and owners can see how many times each link was clicked. 

### Step 0: Constitution (once per project)

The constitution is the set of rules Claude checks every plan against. Write rules a reviewer could fail a pull request on.

```text
/speckit-constitution TDD, Clean Code, Usability, YAGNI principle , User Interfaces should not like AI.
```

Read the generated in `.specify/memory/constitution.md`, fix any issues and commit it.


### Step 1: Specify the feature

Describe behavior, users and limits. Leave out every technology name.

```text
/speckit-specify Build url link shortening application. A signed-in user submits
a long web address and gets a short link with a random 7-character code.
Codes are never reused, even after a link is deleted. Anyone who opens a
short link is sent to the original address. A user can set an expiry
date; after it, the link shows a "link expired" page instead of
redirecting. A user can disable a link and enable it again. Every
redirect counts as a click, and owners see total clicks and clicks per
day for the last 30 days. Users only see and manage their own links.
95% of redirects must complete within 50 ms with 1 million stored links.
```

Claude creates `specs/001-url-shortener/spec.md`. I will contains prioritized user stories, numbered requirements and measurable success criteria. There will be no implementation details in these spec files.

### Step 2: Clarify

Run `/speckit-clarify`. Claude asks about gaps one at a time and writes your answers into the spec. 

![[Pasted image 20261117182448.png]]

Each of these would otherwise have been guessed by the model during implementation.

**`checklists/requirements.md`**

Specify generates this file automatically. It checks the spec, not the code. You tick each item the spec satisfies, and fix the spec where it does not.

### Step 3: Plan

Now give the technology and the architectural constraints.

```text
/speckit-plan Use Python 3.12 with FastAPI, SQLite for storage and pytest
for tests.
```

Review the output as you would a colleague's design document:

- [ ] `data-model.md`: every table
- [ ] `contracts/`: the OpenAPI file covers every user story, with error responses
- [ ] `plan.md`: the Constitution Check section passes with no unexplained exceptions
- [ ] `research.md`: each decision has a reason you agree with; ask Claude to verify versions of fast-moving libraries
- [ ] Nothing is built that the spec did not ask for

### Step 4: Tasks and analysis

Run `/speckit-tasks`, then `/speckit-analyze`. The task list is grouped by phase and by user story, so each story can be built and tested alone.

```text
## Phase 2: Foundational
- [ ] T004 Create tickets, ticket_messages, ticket_events tables
      in migrations/versions/
- [ ] T005 Add row-level security policies in migrations/versions/

## Phase 3: User Story 1 ...
```

`[P]` marks tasks that can run in parallel; `[US1]` ties a task to its user story.

Resolve every CRITICAL finding from analyze before going on. A constitution conflict is always CRITICAL.

### Step 5: Implement in slices

Do not let one run build the whole feature unseen. Stop after each story.

```text
/speckit-implement Stop after Phase 3 (User Story 1) so I can review.
```

After each slice:
1. It is better to run the test suite manually. Better not to rely on Claude's report of it.
2. Read the diff.
3. Commit with the task IDs in the message.
4. Continue with `/speckit-implement Continue with Phase 4`.

### Step 6: Converge and merge

Run `/speckit-converge`. It compares the code with the spec, plan, tasks and constitution. It never edits code. If it finds gaps it appends a convergence phase to `tasks.md`; run `/speckit-implement` again, then converge again. Stop when it reports `Converged`.

If the same finding returns after three rounds, the spec and plan disagree with each other. Fix the documents, not the code. Open one pull request containing the `specs/001-url-shortener/` folder and the code together. Ideally the reviewer should reads the spec first, then the diff.