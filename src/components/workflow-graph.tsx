"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";

import type { OmpTimelineEvent } from "@/lib/replay/omp";
import type {
  WorkflowGraphData,
  WorkflowNode,
} from "@/lib/workflow/schema";

const NODE_WIDTH = 288;
const NODE_HEIGHT = 148;
const LONG_WORKFLOW_NODE_THRESHOLD = 8;

type LayoutDirection = "LR" | "TB";

type WorkflowNodeData = {
  direction: LayoutDirection;
  step: number;
  total: number;
  workflow: WorkflowNode;
};

type WorkflowFlowNode = Node<WorkflowNodeData, "workflow">;
type WorkflowFlowEdge = Edge;

type NodeKindStyle = {
  badgeClassName: string;
  borderClassName: string;
};

const NODE_KIND_STYLES: Record<WorkflowNode["kind"], NodeKindStyle> = {
  failure: {
    badgeClassName: "bg-red-50 text-red-700 ring-red-200",
    borderClassName: "border-l-red-500",
  },
  goal: {
    badgeClassName: "bg-neutral-100 text-neutral-800 ring-neutral-300",
    borderClassName: "border-l-neutral-900",
  },
  outcome: {
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    borderClassName: "border-l-emerald-600",
  },
  prompt: {
    badgeClassName: "bg-amber-50 text-amber-800 ring-amber-200",
    borderClassName: "border-l-amber-500",
  },
  response: {
    badgeClassName: "bg-blue-50 text-blue-700 ring-blue-200",
    borderClassName: "border-l-blue-500",
  },
  tool: {
    badgeClassName: "bg-violet-50 text-violet-700 ring-violet-200",
    borderClassName: "border-l-violet-500",
  },
};

const nodeTypes = { workflow: WorkflowNodeCard };

function getNodeStyle(kind: WorkflowNode["kind"]) {
  return NODE_KIND_STYLES[kind];
}

function formatKindLabel(kind: WorkflowNode["kind"]) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function getEvidenceLabel(count: number) {
  return `${count} evidence event${count === 1 ? "" : "s"}`;
}

function getWorkflowDirection(workflow: WorkflowGraphData): LayoutDirection {
  return workflow.nodes.length >= LONG_WORKFLOW_NODE_THRESHOLD ? "TB" : "LR";
}

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const node = data.workflow;
  const style = getNodeStyle(node.kind);
  const targetPosition =
    data.direction === "TB" ? Position.Top : Position.Left;
  const sourcePosition =
    data.direction === "TB" ? Position.Bottom : Position.Right;

  return (
    <article
      className={`h-[148px] w-72 rounded-xl border border-neutral-200 border-l-4 bg-white px-3.5 py-3 text-left shadow-sm transition-shadow ${style.borderClassName} ${
        selected
          ? "shadow-md ring-2 ring-neutral-950 ring-offset-2"
          : "hover:shadow-md"
      }`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!h-2.5 !w-2.5 !border-neutral-400 !bg-white"
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ${style.badgeClassName}`}
        >
          {formatKindLabel(node.kind)}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
          {data.step}/{data.total}
        </span>
      </div>
      <h3
        className="mt-2 overflow-hidden text-sm leading-5 font-semibold text-neutral-950"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {node.title}
      </h3>
      <p
        className="mt-1 overflow-hidden text-xs leading-4 text-neutral-600"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
        }}
      >
        {node.description}
      </p>
      <p className="mt-2 text-[10px] font-medium text-neutral-400">
        {getEvidenceLabel(node.evidenceEventIds.length)}
      </p>
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-2.5 !w-2.5 !border-neutral-400 !bg-white"
      />
    </article>
  );
}

function layoutWorkflow(workflow: WorkflowGraphData) {
  const direction = getWorkflowDirection(workflow);
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: direction,
    ranksep: direction === "TB" ? 48 : 72,
    nodesep: direction === "TB" ? 36 : 48,
    marginx: 36,
    marginy: 36,
  });

  for (const node of workflow.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of workflow.edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const nodes: WorkflowFlowNode[] = workflow.nodes.map((node, index) => {
    const position = graph.node(node.id);

    return {
      id: node.id,
      type: "workflow",
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      data: {
        direction,
        step: index + 1,
        total: workflow.nodes.length,
        workflow: node,
      },
      sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
      targetPosition: direction === "TB" ? Position.Top : Position.Left,
    };
  });

  const edges: WorkflowFlowEdge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.label || undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: "#737373",
    },
    style: { stroke: "#737373", strokeWidth: 1.75 },
    labelStyle: { fill: "#404040", fontSize: 11, fontWeight: 500 },
    labelBgPadding: [6, 4],
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
  }));

  return { direction, edges, nodes };
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

function formatEventKind(kind: OmpTimelineEvent["kind"]) {
  return kind.replaceAll("_", " ");
}

function WorkflowCanvas({
  edges,
  layoutKey,
  nodes,
  onSelectNode,
  selectedNodeId,
}: {
  edges: WorkflowFlowEdge[];
  layoutKey: string;
  nodes: WorkflowFlowNode[];
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string | null;
}) {
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null);
  const initialCenteringDoneRef = useRef(false);

  const fitGraph = useCallback(() => {
    void flowInstance?.fitView({ duration: 250, maxZoom: 1, padding: 0.18 });
  }, [flowInstance]);

  const centerSelectedNode = useCallback(
    (zoom?: number, duration = 250) => {
      if (!flowInstance) {
        return;
      }

      const selectedNode =
        nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];

      if (!selectedNode) {
        return;
      }

      void flowInstance.setCenter(
        selectedNode.position.x + NODE_WIDTH / 2,
        selectedNode.position.y + NODE_HEIGHT / 2,
        { duration, zoom: zoom ?? flowInstance.getZoom() },
      );
    },
    [flowInstance, nodes, selectedNodeId],
  );

  useEffect(() => {
    if (!flowInstance) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      centerSelectedNode(
        undefined,
        initialCenteringDoneRef.current ? 250 : 0,
      );
      initialCenteringDoneRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [centerSelectedNode, flowInstance, layoutKey]);

  return (
    <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      minZoom={0.2}
      maxZoom={1.35}
      panOnScroll
      panOnScrollSpeed={0.55}
      selectionOnDrag={false}
      onInit={setFlowInstance}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      aria-label="Session workflow graph"
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#d4d4d4" gap={24} size={1} />
      <Controls
        fitViewOptions={{ maxZoom: 1, padding: 0.18 }}
        position="bottom-left"
        showInteractive={false}
      />
      <Panel position="top-left" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={fitGraph}
          className="nodrag nopan rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          Fit graph
        </button>
        <button
          type="button"
          onClick={() => centerSelectedNode()}
          className="nodrag nopan rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          Center selected
        </button>
        <button
          type="button"
          onClick={() => centerSelectedNode(1)}
          className="nodrag nopan rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          Reset zoom
        </button>
      </Panel>
      <Panel
        position="top-right"
        className="hidden max-w-56 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] leading-4 text-neutral-500 shadow-sm md:block"
      >
        Selected steps center automatically. Scroll or pinch to zoom. Drag the
        canvas to pan. Use Fit graph when you want the full overview.
      </Panel>
    </ReactFlow>
  );
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
  const layoutKey = useMemo(
    () => workflow.nodes.map((node) => node.id).join("|"),
    [workflow.nodes],
  );
  const flowNodes = useMemo(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [layout.nodes, selectedNodeId],
  );
  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  );

  const selectedNode =
    workflow.nodes.find((node) => node.id === selectedNodeId) ??
    workflow.nodes[0] ??
    null;
  const selectedNodeIndex = selectedNode
    ? workflow.nodes.findIndex((node) => node.id === selectedNode.id)
    : -1;
  const evidence = selectedNode
    ? selectedNode.evidenceEventIds
        .map((id) => eventsById.get(id))
        .filter((event): event is OmpTimelineEvent => event !== undefined)
    : [];
  const directionLabel =
    layout.direction === "TB" ? "vertical layout" : "timeline layout";

  function selectNodeAt(index: number) {
    const node = workflow.nodes[index];

    if (node) {
      setSelectedNodeId(node.id);
    }
  }

  return (
    <div>
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-950">
            {workflow.title}
          </h2>
          <p className="text-xs text-neutral-500">
            {workflow.nodes.length} steps · {directionLabel} · drag to pan
          </p>
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-5 text-neutral-600">
          {workflow.summary}
        </p>
      </div>

      <div className="grid border-b border-neutral-200 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-[34rem] min-h-[28rem] bg-neutral-50 lg:h-[min(72vh,44rem)]">
          <WorkflowCanvas
            edges={layout.edges}
            layoutKey={layoutKey}
            nodes={flowNodes}
            selectedNodeId={selectedNode?.id ?? null}
            onSelectNode={setSelectedNodeId}
          />
        </div>

        <section
          className="border-t border-neutral-200 bg-white px-4 py-4 lg:max-h-[min(72vh,44rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l"
          aria-labelledby="selected-node-heading"
        >
          {selectedNode ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                    Step {selectedNodeIndex + 1} of {workflow.nodes.length}
                  </p>
                  <h3
                    id="selected-node-heading"
                    className="mt-1 text-base leading-6 font-semibold text-neutral-950"
                  >
                    {selectedNode.title}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ${
                    getNodeStyle(selectedNode.kind).badgeClassName
                  }`}
                >
                  {formatKindLabel(selectedNode.kind)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-5 text-neutral-600">
                {selectedNode.description}
              </p>

              <div className="mt-4">
                <label
                  htmlFor="workflow-step-jump"
                  className="text-xs font-semibold text-neutral-900"
                >
                  Jump to step
                </label>
                <select
                  id="workflow-step-jump"
                  value={selectedNode.id}
                  onChange={(event) => setSelectedNodeId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                >
                  {workflow.nodes.map((node, index) => (
                    <option key={node.id} value={node.id}>
                      {index + 1}. {formatKindLabel(node.kind)} — {node.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Selecting a step centers it in the graph.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectNodeAt(selectedNodeIndex - 1)}
                  disabled={selectedNodeIndex <= 0}
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:bg-neutral-50"
                >
                  Previous step
                </button>
                <button
                  type="button"
                  onClick={() => selectNodeAt(selectedNodeIndex + 1)}
                  disabled={
                    selectedNodeIndex === -1 ||
                    selectedNodeIndex >= workflow.nodes.length - 1
                  }
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:bg-neutral-50"
                >
                  Next step
                </button>
                {evidence[0] ? (
                  <button
                    type="button"
                    onClick={() => onOpenEvidence(evidence[0].id)}
                    className="rounded-md border border-neutral-900 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                  >
                    Open first evidence
                  </button>
                ) : null}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-neutral-900">
                    Evidence
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {getEvidenceLabel(evidence.length)}
                  </p>
                </div>
                {evidence.length > 0 ? (
                  <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                    {evidence.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => onOpenEvidence(event.id)}
                          className="grid w-full gap-2 px-3 py-3 text-left hover:bg-neutral-50"
                        >
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                            <span className="font-medium text-neutral-700">
                              Line {event.lineNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatEventTime(event.timestamp)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {event.actor} · {formatEventKind(event.kind)}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-neutral-950">
                            {event.label}
                          </span>
                          <span className="line-clamp-2 text-xs leading-4 text-neutral-500">
                            {event.text ?? "Open this event in the timeline"}
                          </span>
                          <span className="text-[11px] font-medium text-neutral-900">
                            Open in timeline →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-500">
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
    </div>
  );
}
