"use client";

import { useMemo } from "react";

import { WorkflowGraph } from "@/components/workflow-graph";
import type { OmpReplay } from "@/lib/replay/omp";
import { buildWorkflowGraph } from "@/lib/workflow/build";

export function WorkflowView({
  replay,
  onOpenEvidence,
}: {
  replay: OmpReplay;
  onOpenEvidence: (eventId: string) => void;
}) {
  const workflow = useMemo(() => buildWorkflowGraph(replay), [replay]);

  return (
    <div id="workflow-panel" role="tabpanel" aria-labelledby="workflow-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <p className="text-xs text-neutral-600">Factual workflow</p>
        <p className="text-xs text-neutral-500">
          Generated locally · no model request
        </p>
      </div>
      <WorkflowGraph
        workflow={workflow}
        events={replay.timeline}
        onOpenEvidence={onOpenEvidence}
      />
    </div>
  );
}
