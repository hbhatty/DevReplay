# DevReplay

DevReplay is a local-first developer tool that transforms AI-assisted coding
sessions into searchable timelines and evidence-linked workflow graphs.

It helps developers review what happened during a session without rereading an
entire conversation, including the decisions made, approaches attempted, code
changes performed, test results, and unresolved work.

## Scope

- Import a structured coding-session file
- Validate and process the session in the browser
- Display prompts, commands, file activity, and test results in a searchable timeline
- Generate a structured workflow from minimized session events
- Visualize the workflow as an interactive graph
- Link workflow nodes back to their supporting session evidence
- Export an evidence-linked Markdown summary
- Include a synthetic demo containing no private data

## How it works

1. A DevReplay exporter converts a coding session into structured JSON.
2. DevReplay validates the file and constructs the timeline locally.
3. The user reviews the minimized payload prepared for analysis.
4. The OpenAI API classifies events into workflow stages.
5. DevReplay validates and displays the result as an evidence-linked graph.

The OpenAI API does not automatically access Codex, Claude, or other assistant
histories. DevReplay analyzes only the data explicitly imported and approved
by the user.

## Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Flow
- Dagre
- Zod
- OpenAI API
- Vitest
- Playwright

## Privacy

The original session file will remain in the browser and will never be sent to
the AI provider. Only allowlisted and minimized event data will be prepared for
analysis, and the user will be able to inspect the outgoing payload before
confirming the request.

## Status

DevReplay is continuously being improved
