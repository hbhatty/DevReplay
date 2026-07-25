"use client";

import { useRef, useState, type ChangeEvent } from "react";

import {
  parseOmpJsonl,
  type OmpImportIssue,
  type OmpReplay,
} from "@/lib/replay/omp";
import { ReplayTimeline } from "@/components/replay-timeline";

const MAX_REPLAY_FILE_SIZE = 5 * 1024 * 1024;

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
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });

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
      setImportState(parseReplayText(file.name, await file.text()));
    } catch {
      setImportState({
        status: "error",
        fileName: file.name,
        messages: ["The browser could not read this file. Try selecting it again."],
      });
    }
  }

  const isLoading = importState.status === "loading";

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
          disabled={isLoading}
          className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Reading session..." : "Import OMP session"}
        </button>
        <p className="w-full text-xs text-neutral-500 sm:ml-auto sm:w-auto">
          JSONL / 5 MB max / processed in this browser
        </p>
      </div>

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
        <section
          role="status"
          className="mt-4 overflow-hidden border border-neutral-200 bg-white"
        >
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {importState.replay.summary.title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {importState.fileName}
              </p>
            </div>
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

          <ReplayTimeline events={importState.replay.timeline} />
        </section>
      ) : (
        <section className="mt-4 overflow-hidden border border-neutral-200 bg-white">
          <TimelinePlaceholder
            message={
              isLoading
                ? "Reading session..."
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
