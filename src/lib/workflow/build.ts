import type { OmpReplay, OmpTimelineEvent } from "@/lib/replay/omp";
import type {
  WorkflowEdge,
  WorkflowGraphData,
  WorkflowNode,
  WorkflowNodeKind,
} from "@/lib/workflow/schema";

const DESCRIPTION_LIMIT = 240;

function preview(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length <= DESCRIPTION_LIMIT
    ? normalized
    : `${normalized.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function getToolName(event: OmpTimelineEvent) {
  return event.label.replace(/ (?:called|result)$/, "");
}

function summarizeToolActivity(events: OmpTimelineEvent[]) {
  const calls = events.filter((event) => event.kind === "tool_call");
  const errors = events.filter((event) => event.isError);
  const counts = new Map<string, number>();

  for (const call of calls) {
    const name = getToolName(call);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const tools = [...counts.entries()]
    .map(([name, count]) => (count === 1 ? name : `${name} ×${count}`))
    .join(", ");
  const activity = `${calls.length} tool call${calls.length === 1 ? "" : "s"}${
    tools ? `: ${tools}` : ""
  }.`;

  return {
    kind: errors.length > 0 ? ("failure" as const) : ("tool" as const),
    title:
      errors.length > 0
        ? `Tool activity · ${errors.length} error${errors.length === 1 ? "" : "s"}`
        : "Tool activity",
    description:
      errors.length > 0
        ? `${activity} ${errors.length} result${errors.length === 1 ? "" : "s"} reported an error.`
        : activity,
  };
}

export function buildWorkflowGraph(replay: OmpReplay): WorkflowGraphData {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  let previousNodeId: string | undefined;

  function addNode(
    kind: WorkflowNodeKind,
    title: string,
    description: string,
    evidence: OmpTimelineEvent[],
  ) {
    const node: WorkflowNode = {
      id: `workflow-node-${nodes.length + 1}`,
      kind,
      title,
      description,
      evidenceEventIds: evidence.map((event) => event.id),
    };

    nodes.push(node);

    if (previousNodeId) {
      edges.push({
        id: `workflow-edge-${edges.length + 1}`,
        source: previousNodeId,
        target: node.id,
        kind: "sequence",
        label: "",
      });
    }

    previousNodeId = node.id;
  }

  const promptIndexes = replay.timeline.flatMap((event, index) =>
    event.kind === "user_message" ? [index] : [],
  );

  if (promptIndexes.length === 0) {
    const started = replay.timeline.filter(
      (event) => event.kind === "session_started",
    );
    addNode(
      "goal",
      "Session opened",
      `No user prompt was recorded for “${replay.summary.title}”.`,
      started,
    );
  }

  promptIndexes.forEach((promptIndex, index) => {
    const prompt = replay.timeline[promptIndex];

    if (!prompt) {
      return;
    }

    const nextPromptIndex = promptIndexes[index + 1] ?? replay.timeline.length;
    const turnEvents = replay.timeline.slice(promptIndex + 1, nextPromptIndex);
    const toolEvents = turnEvents.filter(
      (event) => event.kind === "tool_call" || event.kind === "tool_result",
    );
    const responses = turnEvents.filter(
      (event) => event.kind === "assistant_message",
    );

    addNode(
      index === 0 ? "goal" : "prompt",
      index === 0 ? "Initial goal" : `Follow-up prompt ${index + 1}`,
      preview(prompt.text, "The prompt did not contain readable text."),
      [prompt],
    );

    if (toolEvents.length > 0) {
      const summary = summarizeToolActivity(toolEvents);
      addNode(
        summary.kind,
        summary.title,
        summary.description,
        toolEvents,
      );
    }

    if (responses.length > 0) {
      const finalResponse = responses.at(-1);
      addNode(
        "response",
        index === 0 ? "Model response" : `Response to prompt ${index + 1}`,
        preview(
          finalResponse?.text,
          `${responses.length} model response${responses.length === 1 ? " was" : "s were"} recorded.`,
        ),
        responses,
      );
    }
  });

  const completedEvents = replay.timeline.filter(
    (event) => event.kind === "session_completed",
  );
  const outcomeEvidence =
    completedEvents.length > 0
      ? completedEvents
      : replay.timeline.slice(Math.max(0, replay.timeline.length - 1));
  const errorCount = replay.timeline.filter((event) => event.isError).length;

  addNode(
    "outcome",
    replay.summary.status === "completed"
      ? "Session completed"
      : "Session incomplete",
    `${promptIndexes.length} prompt${promptIndexes.length === 1 ? "" : "s"}, ${
      replay.summary.toolCallCount
    } tool call${replay.summary.toolCallCount === 1 ? "" : "s"}, and ${
      errorCount
    } tool error${errorCount === 1 ? "" : "s"} were recorded.`,
    outcomeEvidence,
  );

  return {
    title: `${replay.summary.title} workflow`,
    summary: `Generated locally from ${replay.timeline.length} recorded events. The graph preserves event order and does not use model interpretation.`,
    nodes,
    edges,
  };
}
