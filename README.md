# DevReplay

DevReplay is a local-first developer tool for exploring AI-assisted coding
sessions as readable timelines and evidence-linked workflow graphs.

Instead of rereading a long transcript, a developer can trace the prompts,
responses, tool activity, errors, and completion state. Every workflow node
links back to the session events that produced it.

> **Status:** Early build. OMP JSONL import, timeline exploration, and the
> locally generated factual workflow are implemented.

## Current workflow

1. Import an OMP `.jsonl` session from the browser.
2. DevReplay parses and validates the file locally.
3. Explore the complete session in the timeline.
4. Open the workflow view to see prompts, responses, grouped tool activity,
   errors, and the recorded outcome.
5. Select a graph node to inspect its evidence in the original timeline.

The factual workflow is deterministic and makes no model or network request.
A later optional analysis layer will let users apply saved, personalized
analysis profiles through local Codex or a configured API provider.

## Scope

### Implemented

- OMP JSONL import and validation
- Session metadata and record summaries
- Readable, expandable event timeline
- Deterministic workflow graph with automatic layout
- Graph-to-timeline evidence navigation
- Browser-only processing for imported session data
- Optional server-only OpenAI Responses adapter with structured output

### Planned

- Timeline search and event filters
- Saved analysis profiles
- Optional local Codex analysis
- Provider selection and model-assisted analysis UI
- Exportable evidence-linked report
- Focused parser and privacy tests

Accounts, cloud storage, and team collaboration are intentionally outside the
current scope.

## Privacy

- Imported session files are read in the browser and are not uploaded.
- The timeline and factual workflow work without an AI provider.
- The OpenAI adapter is not connected to a route or the current interface.
- Any future model-assisted analysis will be optional and will show what data
  is being sent before an external request.

## Technology

| Technology | Purpose |
| --- | --- |
| Next.js, React, TypeScript | Application structure and interface |
| Tailwind CSS | Minimal visual design |
| React Flow (`@xyflow/react`) | Interactive workflow graph |
| Dagre (`@dagrejs/dagre`) | Automatic directed-graph layout |
| Zod | Runtime validation for provider-generated graphs |
| OpenAI SDK | Optional server-side Responses API adapter |

## Development

DevReplay requires Node.js 24 LTS and `pnpm` 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Optional OpenAI provider

OpenAI support is implemented as a dormant server-only adapter. The current UI
does not import it, expose an analysis endpoint, or make model requests.

To prepare local configuration for a future opt-in analysis flow:

```bash
cp .env.example .env.local
```

Add an API key to `OPENAI_API_KEY`. The adapter defaults to
`gpt-5.6-luna`; `DEVREPLAY_OPENAI_MODEL` can override it. `.env.local` is
ignored by Git and must never be committed.

Development is delivered through small, runnable milestones. AI-provider
execution remains optional and will be connected only after the local
exploration workflow is useful on its own.
