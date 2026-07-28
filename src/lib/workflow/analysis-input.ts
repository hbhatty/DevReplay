import type { JsonValue, OmpReplay } from "@/lib/replay/omp";
import type { WorkflowGraphData } from "@/lib/workflow/schema";

const MAX_EVENTS = 400;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOOL_TEXT_LENGTH = 2_000;
const MAX_TOOL_DETAILS_LENGTH = 1_500;

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9_-]{16,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[a-zA-Z0-9._~+/=-]{16,}\b/gi,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["']?[^\s,"']{8,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const DEFAULT_ANALYSIS_PROFILE =
  "Group the session by developer intent. Emphasize decisions, failed approaches, corrections, meaningful tool activity, and the final outcome. Collapse routine successful operations.";

export interface WorkflowAnalysisEvent {
  id: string;
  kind: string;
  actor: string;
  label: string;
  timestamp: string | null;
  text: string | null;
  details: string | null;
  isError: boolean;
}

export interface WorkflowAnalysisInput {
  sessionTitle: string;
  sourceModel: string | null;
  profileInstructions: string;
  events: WorkflowAnalysisEvent[];
  truncated: boolean;
}

export interface WorkflowAnalyzerResult {
  provider: string;
  model: string;
  workflow: WorkflowGraphData;
}

export interface WorkflowAnalyzer {
  analyze(input: WorkflowAnalysisInput): Promise<WorkflowAnalyzerResult>;
}

function redactSecrets(value: string) {
  return SECRET_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[REDACTED]"),
    value,
  );
}

function truncate(value: string, limit: number) {
  return value.length <= limit
    ? value
    : `${value.slice(0, limit)}\n[TRUNCATED]`;
}

function stringifyDetails(value: JsonValue | undefined) {
  if (value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

export function createWorkflowAnalysisInput(
  replay: OmpReplay,
  profileInstructions = DEFAULT_ANALYSIS_PROFILE,
): WorkflowAnalysisInput {
  const usefulEvents = replay.timeline.filter(
    (event) => event.kind !== "instruction",
  );

  return {
    sessionTitle: replay.summary.title,
    sourceModel: replay.summary.model ?? null,
    profileInstructions,
    truncated: usefulEvents.length > MAX_EVENTS,
    events: usefulEvents.slice(0, MAX_EVENTS).map((event) => {
      const textLimit =
        event.kind === "tool_result"
          ? MAX_TOOL_TEXT_LENGTH
          : MAX_MESSAGE_LENGTH;
      const details = stringifyDetails(event.details);

      return {
        id: event.id,
        kind: event.kind,
        actor: event.actor,
        label: event.label,
        timestamp: event.timestamp ?? null,
        text: event.text
          ? truncate(redactSecrets(event.text), textLimit)
          : null,
        details: details
          ? truncate(redactSecrets(details), MAX_TOOL_DETAILS_LENGTH)
          : null,
        isError: event.isError === true,
      };
    }),
  };
}
