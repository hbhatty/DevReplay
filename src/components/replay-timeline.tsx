import { useMemo, useState } from "react";

import type { JsonValue, OmpTimelineEvent } from "@/lib/replay/omp";

const MESSAGE_PREVIEW_LENGTH = 360;
const EVENT_PREVIEW_LENGTH = 220;
const ASSISTANT_SKIM_ITEM_LIMIT = 4;
const ASSISTANT_SKIM_ITEM_LENGTH = 180;

type TimelineSummary = {
  prompts: number;
  responses: number;
  toolCalls: number;
  errors: number;
};

type TimelineTone = {
  cardClassName: string;
  accentClassName: string;
  badgeClassName: string;
};

type TimelineView = "conversation" | "all" | "errors";

const TIMELINE_VIEW_OPTIONS: Array<{
  id: TimelineView;
  label: string;
  description: string;
}> = [
  {
    id: "conversation",
    label: "Conversation",
    description: "User prompts and assistant responses",
  },
  {
    id: "all",
    label: "All activity",
    description: "Every parsed event",
  },
  {
    id: "errors",
    label: "Errors",
    description: "Failed tool results",
  },
];

const EMPTY_TIMELINE_MESSAGES: Record<TimelineView, string> = {
  conversation: "No user prompts or assistant responses were found.",
  all: "No useful timeline events were found in this session.",
  errors: "No failed tool results were found.",
};

function formatEventTime(timestamp?: string) {
  if (!timestamp) {
    return "—";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDetails(details: JsonValue) {
  return typeof details === "string"
    ? details
    : JSON.stringify(details, null, 2);
}

function getStatus(event: OmpTimelineEvent) {
  if (event.isError) {
    return { label: "Error", className: "text-red-700" };
  }

  if (event.kind === "tool_result") {
    return { label: "Success", className: "text-emerald-700" };
  }

  if (event.kind === "tool_call") {
    return { label: "Called", className: "text-amber-700" };
  }

  if (event.kind === "session_started") {
    return { label: "Started", className: "text-neutral-500" };
  }

  if (event.kind === "session_completed") {
    return { label: "Completed", className: "text-emerald-700" };
  }

  if (event.kind === "user_message") {
    return { label: "Prompt", className: "text-neutral-700" };
  }

  if (event.kind === "assistant_message") {
    return { label: "Response", className: "text-indigo-700" };
  }

  return { label: "Recorded", className: "text-neutral-500" };
}

function EventText({
  text,
  prominent,
  previewLength,
  fullLabel,
  hideLongPreview = false,
}: {
  text: string;
  prominent: boolean;
  previewLength: number;
  fullLabel: string;
  hideLongPreview?: boolean;
}) {
  const textClassName = prominent
    ? "text-[15px] leading-7 text-neutral-800"
    : "text-xs leading-5 text-neutral-600";
  const isLong = text.length > previewLength;
  const shouldShowPreview = !isLong || !hideLongPreview;
  const preview = isLong ? `${text.slice(0, previewLength).trimEnd()}…` : text;
  return (
    <div className={`mt-2 ${textClassName}`}>
      {shouldShowPreview ? (
        <p
          className={`whitespace-pre-wrap ${
            prominent ? "max-w-[76ch]" : "max-w-4xl"
          }`}
        >
          {preview}
        </p>
      ) : null}
      {isLong ? (
        <details className={shouldShowPreview ? "mt-2" : "mt-3"}>
          <summary className="cursor-pointer select-none text-xs font-medium text-neutral-500 hover:text-neutral-900">
            {fullLabel}
          </summary>
          <pre className="mt-2 max-h-[32rem] max-w-5xl overflow-auto rounded-md border border-neutral-200 bg-white p-3 font-sans text-sm leading-6 text-neutral-800 shadow-inner">
            {text}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function getAssistantSkimItems(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const structuredLines = lines.filter((line) =>
    /^(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)/.test(line),
  );
  const sentenceLines = lines.flatMap(
    (line) => line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [],
  );
  const candidates =
    structuredLines.length >= 2 ? structuredLines : sentenceLines;
  const items: string[] = [];

  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/^>\s+/, "")
      .replace(/^(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)/, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || items.includes(cleaned)) {
      continue;
    }

    items.push(
      cleaned.length > ASSISTANT_SKIM_ITEM_LENGTH
        ? `${cleaned.slice(0, ASSISTANT_SKIM_ITEM_LENGTH).trimEnd()}…`
        : cleaned,
    );

    if (items.length === ASSISTANT_SKIM_ITEM_LIMIT) {
      break;
    }
  }

  return items;
}

function AssistantSkim({ text }: { text: string }) {
  const items = getAssistantSkimItems(text);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 max-w-[76ch] rounded-md border border-indigo-200 bg-white/75 p-3 text-sm leading-6 text-neutral-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
        Skim preview
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        Extracted from the original response. Expand below for the full text.
      </p>
    </div>
  );
}

function getEventHeading(event: OmpTimelineEvent) {
  if (event.kind === "tool_call" && event.label.endsWith(" called")) {
    return `Tool call: ${event.label.slice(0, -" called".length)}`;
  }

  if (event.kind === "tool_result" && event.label.endsWith(" result")) {
    return `Tool result: ${event.label.slice(0, -" result".length)}`;
  }

  return event.label;
}

function getActorLabel(event: OmpTimelineEvent) {
  if (event.kind === "user_message") {
    return "User";
  }

  if (event.kind === "assistant_message") {
    return "Assistant";
  }

  return event.actor;
}


function getTone(event: OmpTimelineEvent): TimelineTone {
  if (event.kind === "user_message") {
    return {
      cardClassName: "border-neutral-300 bg-neutral-50",
      accentClassName: "bg-neutral-950",
      badgeClassName: "bg-neutral-950 text-white",
    };
  }

  if (event.kind === "assistant_message") {
    return {
      cardClassName: "border-indigo-200 bg-indigo-50/70",
      accentClassName: "bg-indigo-500",
      badgeClassName:
        "bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200",
    };
  }

  if (event.isError) {
    return {
      cardClassName: "border-red-200 bg-red-50/70",
      accentClassName: "bg-red-500",
      badgeClassName: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200",
    };
  }

  if (event.kind === "tool_call") {
    return {
      cardClassName: "border-amber-200 bg-amber-50/70",
      accentClassName: "bg-amber-500",
      badgeClassName:
        "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
    };
  }

  if (event.kind === "tool_result") {
    return {
      cardClassName: "border-emerald-200 bg-emerald-50/70",
      accentClassName: "bg-emerald-500",
      badgeClassName:
        "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    };
  }

  return {
    cardClassName: "border-neutral-200 bg-white",
    accentClassName: "bg-neutral-300",
    badgeClassName:
      "bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200",
  };
}

function summarizeTimeline(events: OmpTimelineEvent[]): TimelineSummary {
  return events.reduce<TimelineSummary>(
    (summary, event) => {
      if (event.kind === "user_message") {
        summary.prompts += 1;
      } else if (event.kind === "assistant_message") {
        summary.responses += 1;
      } else if (event.kind === "tool_call") {
        summary.toolCalls += 1;
      }

      if (event.isError) {
        summary.errors += 1;
      }

      return summary;
    },
    { prompts: 0, responses: 0, toolCalls: 0, errors: 0 },
  );
}

function shouldShowEventInView(event: OmpTimelineEvent, view: TimelineView) {
  if (view === "conversation") {
    return event.kind === "user_message" || event.kind === "assistant_message";
  }

  if (view === "errors") {
    return event.kind === "tool_result" && event.isError === true;
  }

  return true;
}
function TimelineRow({
  event,
  highlighted,
}: {
  event: OmpTimelineEvent;
  highlighted: boolean;
}) {
  const status = getStatus(event);
  const tone = getTone(event);
  const isConversation =
    event.kind === "user_message" || event.kind === "assistant_message";
  const isToolEvent =
    event.kind === "tool_call" || event.kind === "tool_result";
  const details =
    event.details === undefined ? undefined : formatDetails(event.details);
  const previewLength = isConversation
    ? MESSAGE_PREVIEW_LENGTH
    : EVENT_PREVIEW_LENGTH;
  const shouldShowAssistantSkim =
    event.kind === "assistant_message" &&
    event.text !== undefined &&
    event.text.length > MESSAGE_PREVIEW_LENGTH;
  const headingClassName = isConversation
    ? "mt-2 text-base font-semibold text-neutral-950"
    : isToolEvent
      ? "mt-2 text-[15px] font-semibold text-neutral-950"
      : "mt-1.5 text-sm font-semibold text-neutral-900";
  const fullTextLabel =
    event.kind === "user_message"
      ? "Show full original prompt"
      : event.kind === "assistant_message"
        ? "Show full original response"
        : "Show full event text";

  return (
    <li id={`timeline-event-${event.id}`} className="scroll-mt-4 px-2 py-1.5">
      <article
        className={`grid gap-3 rounded-lg border px-3 py-3 shadow-sm transition-colors sm:grid-cols-[5.5rem_0.25rem_minmax(0,1fr)] sm:px-4 ${
          tone.cardClassName
        } ${highlighted ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}
      >
        <div className="flex items-center gap-2 text-xs text-neutral-500 sm:block">
          <time
            dateTime={event.timestamp}
            title={event.timestamp}
            className="block whitespace-nowrap tabular-nums"
          >
            {formatEventTime(event.timestamp)}
          </time>
          <span className="text-neutral-300 sm:hidden" aria-hidden="true">
            /
          </span>
          <span className="whitespace-nowrap text-[11px] uppercase tracking-wide text-neutral-400 sm:mt-1 sm:block">
            line {event.lineNumber}
          </span>
        </div>

        <div
          className={`hidden rounded-full sm:block ${tone.accentClassName}`}
          aria-hidden="true"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.badgeClassName}`}
            >
              {getActorLabel(event)}
            </span>
            <span className={`text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-neutral-400">
              {event.kind.replaceAll("_", " ")}
            </span>
          </div>

          <h3 className={headingClassName}>{getEventHeading(event)}</h3>
          {shouldShowAssistantSkim && event.text ? (
            <AssistantSkim text={event.text} />
          ) : null}
          {event.text ? (
            <EventText
              text={event.text}
              prominent={isConversation}
              previewLength={previewLength}
              fullLabel={fullTextLabel}
              hideLongPreview={shouldShowAssistantSkim}
            />
          ) : null}
          {details ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer select-none font-medium text-neutral-500 hover:text-neutral-900">
                {event.kind === "tool_call" ? "View input" : "View raw result"}
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-3 text-[11px] leading-5 text-neutral-700 shadow-inner">
                {details}
              </pre>
            </details>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function ReplayTimeline({
  events,
  highlightedEventId,
}: {
  events: OmpTimelineEvent[];
  highlightedEventId?: string;
}) {
  const [selectedView, setSelectedView] =
    useState<TimelineView>("conversation");
  const summary = useMemo(() => summarizeTimeline(events), [events]);
  const highlightedEvent = useMemo(
    () => events.find((event) => event.id === highlightedEventId),
    [events, highlightedEventId],
  );
  const effectiveView =
    highlightedEvent && !shouldShowEventInView(highlightedEvent, selectedView)
      ? "all"
      : selectedView;
  const visibleEvents = useMemo(
    () => events.filter((event) => shouldShowEventInView(event, effectiveView)),
    [events, effectiveView],
  );
  const selectedViewOption =
    TIMELINE_VIEW_OPTIONS.find((option) => option.id === effectiveView) ??
    TIMELINE_VIEW_OPTIONS[0];

  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2
            id="timeline-heading"
            className="text-sm font-medium text-neutral-900"
          >
            Timeline
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Showing {visibleEvents.length} of {events.length} events ·{" "}
            {summary.prompts} prompts · {summary.responses} responses ·{" "}
            {summary.toolCalls} tool calls
            {summary.errors > 0 ? ` · ${summary.errors} errors` : ""}
          </p>
        </div>

        <div
          aria-label="Timeline view"
          className="flex w-full flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 sm:w-auto sm:flex-row"
          role="group"
        >
          {TIMELINE_VIEW_OPTIONS.map((option) => {
            const selected = option.id === effectiveView;

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedView(option.id)}
                className={`rounded-md px-3 py-2 text-left text-xs transition-colors sm:min-w-32 ${
                  selected
                    ? "bg-white font-semibold text-neutral-950 shadow-sm ring-1 ring-neutral-200"
                    : "text-neutral-500 hover:bg-white/70 hover:text-neutral-900"
                }`}
              >
                <span className="block">{option.label}</span>
                <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2 text-xs text-neutral-500 backdrop-blur">
        <span className="font-medium text-neutral-700">Scan key</span>
        <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          User
        </span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 ring-1 ring-inset ring-indigo-200">
          Assistant
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200">
          Tool call
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
          Result
        </span>
        <span className="ml-auto text-[11px] text-neutral-400">
          {selectedViewOption.label}
        </span>
      </div>

      {visibleEvents.length > 0 ? (
        <ol className="bg-neutral-100/70 py-2">
          {visibleEvents.map((event) => (
            <TimelineRow
              key={event.id}
              event={event}
              highlighted={event.id === highlightedEventId}
            />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-neutral-500">
          {EMPTY_TIMELINE_MESSAGES[effectiveView]}
        </p>
      )}
    </section>
  );
}
