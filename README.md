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

### Planned

- Timeline search and event filters
- Saved analysis profiles
- Optional local Codex analysis
- Optional API-provider adapter
- Exportable evidence-linked report
- Focused parser and privacy tests

Accounts, cloud storage, and team collaboration are intentionally outside the
current scope.

## Privacy

- Imported session files are read in the browser and are not uploaded.
- The timeline and factual workflow work without an AI provider.
- Any future model-assisted analysis will be optional and will show what data
  is being sent before an external request.

## Technology

| Technology | Purpose |
| --- | --- |
| Next.js, React, TypeScript | Application structure and interface |
| Tailwind CSS | Minimal visual design |
| React Flow (`@xyflow/react`) | Interactive workflow graph |
| Dagre (`@dagrejs/dagre`) | Automatic directed-graph layout |

## Development

DevReplay requires Node.js 24 LTS and `pnpm` 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Development is delivered through small, runnable milestones. AI-provider
integration remains optional and will be added only after the local exploration
workflow is useful on its own.
