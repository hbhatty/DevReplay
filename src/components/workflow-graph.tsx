"use client";

import { useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import type { OmpTimelineEvent } from "@/lib/replay/omp";
import type {
  WorkflowGraphData,
  WorkflowNode,
} from "@/lib/workflow/schema";

const NODE_WIDTH = 256;
const NODE_HEIGHT = 136;

type WorkflowNodeData = {
  workflow: WorkflowNode;
};

type WorkflowFlowNode = Node<WorkflowNodeData, "workflow">;

function getNodeAccent(kind: WorkflowNode["kind"]) {
  if (kind === "failure") {
    return "border-l-red-500";
  }

  if (kind === "outcome") {
    return "border-l-emerald-600";
  }

  if (kind === "prompt") {
    return "border-l-amber-500";
  }

  if (kind === "response") {
    return "border-l-blue-500";
  }

  if (kind === "goal") {
    return "border-l-neutral-900";
  }

  return "border-l-neutral-400";
}

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const node = data.workflow;

  return (
    <div
      className={`h-[136px] w-64 border border-neutral-300 border-l-4 bg-white px-3 py-2.5 text-left ${getNodeAccent(
        node.kind,
      )} ${selected ? "ring-2 ring-neutral-900 ring-offset-2" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-neutral-400 !bg-white"
      />
      <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        {node.kind}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-950">
        {node.title}
      </p>
      <p className="mt-1 max-h-12 overflow-hidden text-xs leading-4 text-neutral-600">
        {node.description}
      </p>
      <p className="mt-2 text-[10px] text-neutral-400">
        {node.evidenceEventIds.length} evidence event
        {node.evidenceEventIds.length === 1 ? "" : "s"}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-neutral-400 !bg-white"
      />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNodeCard };

function layoutWorkflow(workflow: WorkflowGraphData) {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: 88,
    nodesep: 42,
    marginx: 32,
    marginy: 32,
  });

  for (const node of workflow.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of workflow.edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const nodes: WorkflowFlowNode[] = workflow.nodes.map((node) => {
    const position = graph.node(node.id);

    return {
      id: node.id,
      type: "workflow",
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      data: { workflow: node },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label || undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: "#a3a3a3",
    },
    style: { stroke: "#a3a3a3", strokeWidth: 1.5 },
    labelStyle: { fill: "#525252", fontSize: 11 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}

function formatEventTime(timestamp?: string) {
  if (!timestamp) {
    return "Time not recorded";
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}

export function WorkflowGraph({
  workflow,
  events,
  onOpenEvidence,
}: {
  workflow: WorkflowGraphData;
  events: OmpTimelineEvent[];
  onOpenEvidence: (eventId: string) => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState(
    workflow.nodes[0]?.id ?? null,
  );
  const layout = useMemo(() => layoutWorkflow(workflow), [workflow]);
  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  );

  const selectedNode =
    workflow.nodes.find((node) => node.id === selectedNodeId) ??
    workflow.nodes[0] ??
    null;
  const evidence = selectedNode
    ? selectedNode.evidenceEventIds
        .map((id) => eventsById.get(id))
        .filter((event): event is OmpTimelineEvent => event !== undefined)
    : [];

  return (
    <div>
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-950">
            {workflow.title}
          </h2>
          <p className="text-xs text-neutral-500">
            {workflow.nodes.length} steps · drag to pan
          </p>
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-5 text-neutral-600">
          {workflow.summary}
        </p>
      </div>

      <div className="h-[34rem] border-b border-neutral-200 bg-neutral-50">
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          defaultViewport={{ x: 24, y: 170, zoom: 0.85 }}
          minZoom={0.3}
          maxZoom={1.5}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          aria-label="Session workflow graph"
        >
          <Background color="#d4d4d4" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <section className="px-4 py-4" aria-labelledby="selected-node-heading">
        {selectedNode ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                  Selected {selectedNode.kind}
                </p>
                <h3
                  id="selected-node-heading"
                  className="mt-1 text-sm font-semibold text-neutral-950"
                >
                  {selectedNode.title}
                </h3>
                <p className="mt-1 max-w-4xl text-sm leading-5 text-neutral-600">
                  {selectedNode.description}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-neutral-900">Evidence</p>
              {evidence.length > 0 ? (
                <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200">
                  {evidence.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onOpenEvidence(event.id)}
                        className="grid w-full gap-1 px-1 py-2.5 text-left hover:bg-neutral-50 sm:grid-cols-[7rem_10rem_1fr] sm:gap-3"
                      >
                        <span className="text-xs tabular-nums text-neutral-500">
                          {formatEventTime(event.timestamp)}
                        </span>
                        <span className="text-xs font-medium text-neutral-900">
                          {event.label}
                        </span>
                        <span className="truncate text-xs text-neutral-500">
                          {event.text ?? "Open this event in the timeline"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-neutral-500">
                  No valid source events were attached to this node.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            Select a graph node to inspect its evidence.
          </p>
        )}
      </section>
    </div>
  );
}
