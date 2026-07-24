# DevReplay

DevReplay is a local-first developer tool that turns AI-assisted coding
sessions into searchable timelines and evidence-linked workflow graphs.

Instead of rereading a long conversation, a developer can quickly trace the
goal, decisions, failed approaches, code changes, test results, and unresolved
work. Every workflow item links back to the session events that support it.

> **Status:** Early build. The application shell is runnable; the next
> milestone is a synthetic session displayed as a timeline.

## How it works

1. Export a session as `session.devreplay.json` using a DevReplay exporter
   skill or a supported structured-session importer.
2. Import the file into DevReplay. The file is parsed and validated in the
   browser.
3. Explore the original events through a searchable, filterable timeline.
4. Optionally review a minimized and redacted payload, then request workflow
   analysis.
5. Inspect the resulting workflow graph and open any node to view its source
   evidence.
6. Export an evidence-linked Markdown handoff.

The exporter captures session facts; DevReplay owns the validation, analysis,
visualization, and evidence navigation.

## V1 scope

- Bundled synthetic session for the public demo
- Import and validation for `session.devreplay.json`
- Source and completeness warnings
- Searchable timeline with event-type filters
- Workflow analysis with structured, validated output
- Interactive graph with an evidence panel
- Markdown handoff export

Accounts, cloud session storage, team collaboration, cross-session search, and
multiple native importers are intentionally outside V1.

## Privacy

- The raw session file is parsed in the browser and is never uploaded.
- The timeline works without an AI request.
- Workflow analysis receives only allowlisted, minimized event fields.
- Common secrets and identifying values are masked before analysis.
- The user can inspect the exact outgoing payload before confirming the
  request.
- Imported content is treated as untrusted text.
- The hosted demo uses synthetic data and a precomputed workflow.

Automatic redaction reduces risk but cannot guarantee that all sensitive data
has been removed. Users should review the payload before sending it.

## Technology

| Technology | Purpose |
| --- | --- |
| Next.js, React, TypeScript | Application interface and server-side analysis endpoint |
| Tailwind CSS | Custom visual design |
| React Flow (`@xyflow/react`) | Interactive workflow graph |
| Dagre (`@dagrejs/dagre`) | Automatic graph layout |
| Zod | Runtime validation for imports and model output |
| OpenAI API | Structured workflow extraction behind a replaceable interface |
| Vitest | Parser, schema, and component tests |
| Playwright | End-to-end import and exploration tests |
| GitHub Actions | Automated checks |

The AI provider is isolated behind a `WorkflowExtractor` interface so another
provider can be added later without changing the session or graph model.

## Development

DevReplay requires Node.js 24 LTS and `pnpm` 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to view the local application.

The initial build order is:

1. Render a synthetic session as a timeline.
2. Add structured JSON import and validation.
3. Add the workflow graph and evidence navigation.
4. Add opt-in AI analysis and payload review.
5. Add tests, CI, screenshots, and the public demo.

Each milestone should remain runnable and be delivered through focused commits.

## Docker

Docker is planned for the release stage as an optional way to self-host
DevReplay with a server-side API key. It is not required for everyday local
development, and it will be added only after the core import-to-graph workflow
is working.
