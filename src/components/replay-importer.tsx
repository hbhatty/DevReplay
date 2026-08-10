"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ReplayTimeline } from "@/components/replay-timeline";
import { WorkflowView } from "@/components/workflow-view";
import {
  parseOmpJsonl,
  type OmpImportIssue,
  type OmpReplay,
} from "@/lib/replay/omp";
import {
  deleteStoredReplay,
  loadStoredReplay,
  saveStoredReplay,
} from "@/lib/replay/storage";

const MAX_REPLAY_FILE_SIZE = 5 * 1024 * 1024;
const ACTIVE_VIEW_STORAGE_KEY = "devreplay-active-view";

type ActiveView = "workflow" | "timeline";


type ImportState =
  | { status: "idle" }
  | { status: "loading"; fileName: string }
  | {
      status: "error";
      fileName: string;
      messages: string[];
    }
  | {
      status: "success";
      fileName: string;
      replay: OmpReplay;
    };

type PersistenceState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "saving" }
  | { status: "saved"; savedAt: string }
  | { status: "error"; message: string };

function readStoredActiveView(): ActiveView | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);

    return value === "workflow" || value === "timeline" ? value : undefined;
  } catch {
    return undefined;
  }
}

function saveActiveViewPreference(activeView: ActiveView) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  } catch {
    // The active tab is a convenience preference; session viewing still works.
  }
}

function formatIssue(issue: OmpImportIssue) {
  return issue.lineNumber
    ? `Line ${issue.lineNumber}: ${issue.message}`
    : issue.message;
}

function parseReplayText(fileName: string, text: string): ImportState {
  const result = parseOmpJsonl(text);

  if (!result.success) {
    return {
      status: "error",
      fileName,
      messages: result.issues.map(formatIssue),
    };
  }

  return { status: "success", fileName, replay: result.data };
}

export function ReplayImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const userSelectedFileRef = useRef(false);
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [persistenceState, setPersistenceState] = useState<PersistenceState>({
    status: "loading",
  });
  const [activeView, setActiveView] = useState<ActiveView>(
    () => readStoredActiveView() ?? "timeline",
  );
  const [highlightedEventId, setHighlightedEventId] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const stored = await loadStoredReplay();

        if (cancelled || userSelectedFileRef.current) {
          return;
        }

        if (stored.status === "loaded") {
          setImportState({
            status: "success",
            fileName: stored.data.fileName,
            replay: stored.data.replay,
          });
          setPersistenceState({
            status: "saved",
            savedAt: stored.data.savedAt,
          });
          setActiveView(readStoredActiveView() ?? "workflow");
          return;
        }

        if (stored.status === "discarded") {
          setPersistenceState({
            status: "error",
            message: "An invalid saved session was removed.",
          });
          return;
        }

        setPersistenceState({ status: "empty" });
      } catch {
        if (!cancelled) {
          setPersistenceState({
            status: "error",
            message: "Local session storage is unavailable in this browser.",
          });
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (importState.status !== "success") {
      return;
    }

    saveActiveViewPreference(activeView);
  }, [activeView, importState.status]);

  useEffect(() => {
    if (activeView !== "timeline" || !highlightedEventId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`timeline-event-${highlightedEventId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, highlightedEventId]);

  function openFilePicker() {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.value = "";
    inputRef.current.click();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    userSelectedFileRef.current = true;
    setPersistenceState((current) =>
      current.status === "loading" ? { status: "empty" } : current,
    );

    if (!file.name.toLowerCase().endsWith(".jsonl")) {
      setImportState({
        status: "error",
        fileName: file.name,
        messages: ["Select an OMP session file ending in .jsonl."],
      });
      return;
    }

    if (file.size > MAX_REPLAY_FILE_SIZE) {
      setImportState({
        status: "error",
        fileName: file.name,
        messages: ["The replay is larger than the 5 MB import limit."],
      });
      return;
    }

    setImportState({ status: "loading", fileName: file.name });

    try {
      const nextState = parseReplayText(file.name, await file.text());

      setImportState(nextState);

      if (nextState.status === "success") {
        setActiveView("timeline");
        setHighlightedEventId(undefined);
        setPersistenceState({ status: "saving" });

        try {
          const savedAt = await saveStoredReplay(
            nextState.fileName,
            nextState.replay,
          );
          setPersistenceState({ status: "saved", savedAt });
        } catch {
          setPersistenceState({
            status: "error",
            message:
              "The session is open, but this browser could not save it locally.",
          });
        }
      }
    } catch {
      setImportState({
        status: "error",
        fileName: file.name,
        messages: ["The browser could not read this file. Try selecting it again."],
      });
    }
  }

  async function forgetSession() {
    try {
      await deleteStoredReplay();
      setImportState({ status: "idle" });
      setPersistenceState({ status: "empty" });
      setActiveView("timeline");
      setHighlightedEventId(undefined);
    } catch {
      setPersistenceState({
        status: "error",
        message: "The browser could not remove the saved session.",
      });
    }
  }

  const isLoading = importState.status === "loading";
  const isRestoring = persistenceState.status === "loading";
  const isSaving = persistenceState.status === "saving";

  return (
    <section className="mt-5">
      <input
        ref={inputRef}
        type="file"
        accept=".jsonl,application/x-ndjson"
        className="sr-only"
        onChange={importFile}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isLoading || isRestoring || isSaving}
          className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-50"
        >
          {isRestoring
            ? "Checking saved session..."
            : isLoading
              ? "Reading session..."
              : isSaving
                ? "Saving session..."
                : "Import OMP session"}
        </button>
        <p className="w-full text-xs text-neutral-500 sm:ml-auto sm:w-auto">
          JSONL / 5 MB max / processed in this browser
        </p>
      </div>

      {persistenceState.status === "error" ? (
        <p className="mt-2 text-xs text-amber-700">
          {persistenceState.message}
        </p>
      ) : null}

      {importState.status === "error" ? (
        <div
          role="alert"
          className="mt-4 border border-red-200 bg-white p-4 text-sm text-red-900"
        >
          <p className="font-medium">
            Could not import {importState.fileName}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-800">
            {importState.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {importState.status === "success" ? (
        <section className="mt-4 overflow-hidden border border-neutral-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {importState.replay.summary.title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {importState.fileName}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    importState.replay.summary.status === "completed"
                      ? "bg-emerald-600"
                      : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
                {importState.replay.summary.status === "completed"
                  ? "Completed"
                  : "Incomplete"}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">
                  {persistenceState.status === "saving"
                    ? "Saving locally..."
                    : persistenceState.status === "saved"
                      ? "Saved locally"
                      : "Not saved"}
                </span>
                <button
                  type="button"
                  onClick={() => void forgetSession()}
                  disabled={isSaving}
                  className="text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-50"
                >
                  Forget session
                </button>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 border-b border-neutral-200 bg-neutral-50 sm:grid-cols-4">
            <div className="border-b border-neutral-200 px-4 py-3 sm:border-r sm:border-b-0">
              <dt className="text-xs text-neutral-500">Records</dt>
              <dd className="mt-1 text-sm font-medium">
                {importState.replay.summary.recordCount}
              </dd>
            </div>
            <div className="border-b border-neutral-200 px-4 py-3 sm:border-r sm:border-b-0">
              <dt className="text-xs text-neutral-500">Messages</dt>
              <dd className="mt-1 text-sm font-medium">
                {importState.replay.summary.messageCount}
              </dd>
            </div>
            <div className="border-r border-neutral-200 px-4 py-3">
              <dt className="text-xs text-neutral-500">Tool calls</dt>
              <dd className="mt-1 text-sm font-medium">
                {importState.replay.summary.toolCallCount}
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs text-neutral-500">Source</dt>
              <dd className="mt-1 text-sm font-medium">OMP</dd>
            </div>
          </dl>

          <div className="grid gap-5 px-4 py-4 sm:grid-cols-2">
            <section>
              <h2 className="text-xs font-medium text-neutral-900">
                Session
              </h2>
              <dl className="mt-3 space-y-2 text-xs">
                <SummaryRow
                  label="Model"
                  value={importState.replay.summary.model ?? "Not recorded"}
                />
                <SummaryRow
                  label="Format"
                  value={
                    importState.replay.summary.formatVersion === undefined
                      ? "OMP JSONL"
                      : `OMP JSONL v${importState.replay.summary.formatVersion}`
                  }
                />
                <SummaryRow
                  label="Workspace"
                  value={importState.replay.summary.workspace ?? "Not recorded"}
                />
                <SummaryRow
                  label="Tool errors"
                  value={String(importState.replay.summary.toolErrorCount)}
                />
              </dl>
            </section>

            <section>
              <h2 className="text-xs font-medium text-neutral-900">
                Record types
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(
                  importState.replay.summary.eventTypeCounts,
                ).map(([type, count]) => (
                  <div key={type} className="flex justify-between gap-3">
                    <dt className="truncate text-neutral-500">{type}</dt>
                    <dd className="font-medium text-neutral-900">{count}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <div
            role="tablist"
            aria-label="Session views"
            className="flex border-y border-neutral-200 bg-neutral-50 px-4"
          >
            <button
              id="workflow-tab"
              type="button"
              role="tab"
              aria-selected={activeView === "workflow"}
              aria-controls="workflow-panel"
              onClick={() => setActiveView("workflow")}
              className={`border-b-2 px-3 py-2.5 text-xs font-medium ${
                activeView === "workflow"
                  ? "border-neutral-900 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Workflow
            </button>
            <button
              id="timeline-tab"
              type="button"
              role="tab"
              aria-selected={activeView === "timeline"}
              aria-controls="timeline-panel"
              onClick={() => setActiveView("timeline")}
              className={`border-b-2 px-3 py-2.5 text-xs font-medium ${
                activeView === "timeline"
                  ? "border-neutral-900 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Timeline
            </button>
          </div>

          {activeView === "workflow" ? (
            <WorkflowView
              key={importState.replay.summary.sessionId}
              replay={importState.replay}
              onOpenEvidence={(eventId) => {
                setHighlightedEventId(eventId);
                setActiveView("timeline");
              }}
            />
          ) : (
            <div
              id="timeline-panel"
              role="tabpanel"
              aria-labelledby="timeline-tab"
            >
              <ReplayTimeline
                events={importState.replay.timeline}
                highlightedEventId={highlightedEventId}
              />
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 overflow-hidden border border-neutral-200 bg-white">
          <TimelinePlaceholder
            message={
              isLoading
                ? "Reading session..."
                : isRestoring
                  ? "Checking for a saved session..."
                  : "No session loaded. Import an OMP JSONL session."
            }
          />
        </section>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 truncate text-neutral-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

function TimelinePlaceholder({ message }: { message: string }) {
  return (
    <div>
      <div className="grid grid-cols-[5rem_1fr] border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500 sm:grid-cols-[7rem_1fr_7rem_6rem]">
        <span>Time</span>
        <span>Event</span>
        <span className="hidden sm:block">Actor</span>
        <span className="hidden sm:block">Status</span>
      </div>
      <div className="flex min-h-72 items-center justify-center px-4 text-center text-sm text-neutral-500">
        {message}
      </div>
    </div>
  );
}
