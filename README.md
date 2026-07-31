# DevReplay

DevReplay is a local-first developer tool for exploring AI-assisted coding
sessions as readable timelines and evidence-linked workflow graphs.

Instead of rereading a long transcript, a developer can trace the prompts,
responses, tool activity, errors, and completion state. Every workflow node
links back to the session events that produced it.

## Current workflow

1. Import an OMP `.jsonl` session from the browser.
2. DevReplay parses and validates the file locally.
3. Review the conversation by default, or switch to all activity or errors.
4. Open the workflow view to see prompts, responses, grouped tool activity,
   errors, and the recorded outcome.
5. Select a graph node to inspect its evidence in the original timeline.

The factual workflow is deterministic and makes no model or network request.

## Capabilities

### Included

- OMP JSONL import and validation
- Session metadata and record summaries
- Readable, expandable event timeline
- Conversation, all-activity, and error timeline views
- Deterministic workflow graph with automatic layout
- Graph-to-timeline evidence navigation
- Browser-only processing for imported session data
- Single-session persistence in browser IndexedDB with restore and deletion
- Optional server-only OpenAI Responses adapter with structured output

Accounts, cloud storage, and team collaboration are intentionally outside the
current scope.

## Privacy

- Imported session files are read in the browser and are not uploaded.
- The normalized timeline and summary for the latest successful import are
  stored in this browser's IndexedDB so the session survives a refresh. Raw
  JSONL records are not persisted, and **Forget session** removes the saved
  copy.
- Browser-local storage is not an encrypted secrets vault. Anyone with access
  to the browser profile, or malicious code executing on the same origin,
  could read locally saved session content.
- The timeline and factual workflow work without an AI provider.
- The optional OpenAI adapter is server-only and isolated from the browser
  interface, so importing or exploring a session cannot trigger a model request.
- Provider analysis input applies size limits and common secret-pattern
  redaction. Pattern-based redaction is defense in depth and does not guarantee
  that arbitrary session text contains no sensitive data.
- OpenAI requests use `store: false`. This disables Responses application-state
  storage, but it does not by itself eliminate OpenAI's default abuse-monitoring
  retention.

## Technology

| Technology | Purpose |
| --- | --- |
| Next.js, React, TypeScript | Application structure and interface |
| Tailwind CSS | Minimal visual design |
| React Flow (`@xyflow/react`) | Interactive workflow graph |
| Dagre (`@dagrejs/dagre`) | Automatic directed-graph layout |
| Zod | Runtime validation for persisted replays and generated workflow graphs |
| OpenAI SDK | Optional server-side Responses API adapter |

## Development

DevReplay requires Node.js 24 LTS and `pnpm` 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Optional provider adapter

The repository includes a server-only OpenAI Responses adapter as an extension
point. It is intentionally isolated from the browser interface: no import,
endpoint, or browser action can invoke it. This preserves DevReplay's local-only
baseline and prevents unauthenticated provider requests.

For local adapter development:

```bash
cp .env.example .env.local
```

Add an API key to `OPENAI_API_KEY`. The adapter defaults to
`gpt-5.6-luna`; `DEVREPLAY_OPENAI_MODEL` can override it. `.env.local` is
ignored by Git and must never be committed. The key is read only inside the
server-only adapter when an analysis runs; it is not accepted as an adapter
option or stored on the analyzer object.

Do not expose this adapter through an unauthenticated public endpoint. Any
integration that invokes it must include explicit user confirmation, request
size limits, authentication where applicable, rate limiting, and provider-side
spend limits. Use a dedicated project key with the smallest practical access
and budget rather than a personal all-purpose key.

The complete local exploration workflow works without AI-provider execution.
