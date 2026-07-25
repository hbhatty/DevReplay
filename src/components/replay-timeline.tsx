import type { JsonValue, OmpTimelineEvent } from "@/lib/replay/omp";

const MESSAGE_PREVIEW_LENGTH = 420;

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
    return { label: "Called", className: "text-neutral-500" };
  }

  if (event.kind === "session_started") {
    return { label: "Started", className: "text-neutral-500" };
  }

  if (event.kind === "session_completed") {
    return { label: "Completed", className: "text-emerald-700" };
  }

  if (event.kind === "user_message") {
    return { label: "Prompt", className: "text-neutral-600" };
  }

  if (event.kind === "assistant_message") {
    return { label: "Response", className: "text-neutral-600" };
  }

  return { label: "Recorded", className: "text-neutral-500" };
}

function EventText({
  text,
  prominent,
}: {
  text: string;
  prominent: boolean;
}) {
  const textClassName = prominent
    ? "text-sm leading-6 text-neutral-800"
    : "text-xs leading-5 text-neutral-600";

  if (text.length <= MESSAGE_PREVIEW_LENGTH) {
    return <p className={`mt-1 whitespace-pre-wrap ${textClassName}`}>{text}</p>;
  }

  return (
    <div className={`mt-1 ${textClassName}`}>
      <p className="max-w-4xl whitespace-pre-wrap">
        {text.slice(0, MESSAGE_PREVIEW_LENGTH).trimEnd()}…
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-900">
          Read full message
        </summary>
        <pre className="mt-2 max-h-96 max-w-4xl overflow-auto whitespace-pre-wrap border-l border-neutral-200 pl-3 font-sans text-sm leading-6 text-neutral-800">
          {text}
        </pre>
      </details>
    </div>
  );
}

function TimelineRow({
  event,
  highlighted,
}: {
  event: OmpTimelineEvent;
  highlighted: boolean;
}) {
  const status = getStatus(event);
  const isConversation =
    event.kind === "user_message" || event.kind === "assistant_message";
  const rowClassName =
    highlighted
      ? "bg-amber-50"
      : event.kind === "user_message"
        ? "bg-neutral-50"
        : "bg-white";
  const messageClassName = isConversation
    ? event.kind === "user_message"
      ? "border-l-2 border-neutral-900 pl-3"
      : "border-l-2 border-neutral-300 pl-3"
    : "";
  const details =
    event.details === undefined ? undefined : formatDetails(event.details);

  return (
    <li
      id={`timeline-event-${event.id}`}
      className={`grid grid-cols-[5rem_1fr] gap-x-3 px-4 ${
        isConversation ? "py-4" : "py-3"
      } scroll-mt-4 sm:grid-cols-[7rem_1fr_7rem_6rem] ${rowClassName}`}
    >
      <time
        dateTime={event.timestamp}
        title={event.timestamp}
        className="pt-0.5 text-xs tabular-nums text-neutral-500"
      >
        {formatEventTime(event.timestamp)}
      </time>

      <div className={`min-w-0 ${messageClassName}`}>
        <p
          className={
            isConversation
              ? "text-[15px] font-semibold text-neutral-950"
              : "text-sm font-medium text-neutral-900"
          }
        >
          {event.label}
        </p>
        {event.text ? (
          <EventText text={event.text} prominent={isConversation} />
        ) : null}
        {details ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer select-none text-neutral-500 hover:text-neutral-900">
              {event.kind === "tool_call" ? "View input" : "View raw result"}
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap border-l border-neutral-200 pl-3 text-[11px] leading-5 text-neutral-700">
              {details}
            </pre>
          </details>
        ) : null}
        <p className="mt-1 text-[11px] text-neutral-400 sm:hidden">
          {event.actor} · <span className={status.className}>{status.label}</span>
        </p>
      </div>

      <p
        className={`hidden pt-0.5 text-xs text-neutral-600 sm:block ${
          isConversation ? "font-medium" : ""
        }`}
      >
        {event.actor}
      </p>
      <p className={`hidden pt-0.5 text-xs sm:block ${status.className}`}>
        {status.label}
      </p>
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
  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
        <h2 id="timeline-heading" className="text-sm font-medium text-neutral-900">
          Timeline
        </h2>
        <p className="text-xs text-neutral-500">{events.length} events</p>
      </div>

      <div className="grid grid-cols-[5rem_1fr] gap-x-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500 sm:grid-cols-[7rem_1fr_7rem_6rem]">
        <span>Time</span>
        <span>Event</span>
        <span className="hidden sm:block">Actor</span>
        <span className="hidden sm:block">Status</span>
      </div>

      {events.length > 0 ? (
        <ol className="divide-y divide-neutral-200">
          {events.map((event) => (
            <TimelineRow
              key={event.id}
              event={event}
              highlighted={event.id === highlightedEventId}
            />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-neutral-500">
          No useful timeline events were found in this session.
        </p>
      )}
    </section>
  );
}
