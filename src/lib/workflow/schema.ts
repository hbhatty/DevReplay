import { z } from "zod";

export const WorkflowNodeKindSchema = z.enum([
  "goal",
  "prompt",
  "response",
  "tool",
  "failure",
  "outcome",
]);

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  kind: WorkflowNodeKindSchema,
  title: z.string(),
  description: z.string(),
  evidenceEventIds: z.array(z.string()),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.literal("sequence"),
  label: z.string(),
});

export const WorkflowGraphSchema = z.object({
  title: z.string(),
  summary: z.string(),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export type WorkflowNodeKind = z.infer<typeof WorkflowNodeKindSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type WorkflowGraphData = z.infer<typeof WorkflowGraphSchema>;

export function sanitizeWorkflowGraph(
  workflow: WorkflowGraphData,
  validEventIds: Set<string>,
): WorkflowGraphData {
  const nodeIds = new Set<string>();
  const nodes = workflow.nodes.flatMap((node) => {
    if (!node.id || nodeIds.has(node.id)) {
      return [];
    }

    nodeIds.add(node.id);
    return [
      {
        ...node,
        evidenceEventIds: node.evidenceEventIds.filter((id) =>
          validEventIds.has(id),
        ),
      },
    ];
  });
  const edgeIds = new Set<string>();
  const edges = workflow.edges.filter((edge) => {
    if (
      !edge.id ||
      edgeIds.has(edge.id) ||
      edge.source === edge.target ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      return false;
    }

    edgeIds.add(edge.id);
    return true;
  });

  return { ...workflow, nodes, edges };
}
