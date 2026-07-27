export type WorkflowNodeKind =
  | "goal"
  | "prompt"
  | "response"
  | "tool"
  | "failure"
  | "outcome";

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  description: string;
  evidenceEventIds: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: "sequence";
  label: string;
}

export interface WorkflowGraphData {
  title: string;
  summary: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
