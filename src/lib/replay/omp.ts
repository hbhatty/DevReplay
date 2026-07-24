export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface OmpSourceRecord {
  lineNumber: number;
  type: string;
  timestamp?: string;
  raw: JsonObject;
}

export interface OmpReplaySummary {
  sessionId: string;
  formatVersion?: number;
  title: string;
  model?: string;
  workspace?: string;
  startedAt?: string;
  endedAt?: string;
  status: "completed" | "incomplete";
  recordCount: number;
  messageCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  eventTypeCounts: Record<string, number>;
  messageRoleCounts: Record<string, number>;
}

export interface OmpReplay {
  format: "omp-jsonl";
  source: "omp";
  records: OmpSourceRecord[];
  summary: OmpReplaySummary;
}

export interface OmpImportIssue {
  lineNumber?: number;
  message: string;
}

export type OmpImportResult =
  | { success: true; data: OmpReplay }
  | { success: false; issues: OmpImportIssue[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readTimestamp(record: UnknownRecord): string | undefined {
  const timestamp = readString(record, "timestamp");

  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    return undefined;
  }

  return timestamp;
}

function incrementCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function findLastRecord(
  records: OmpSourceRecord[],
  predicate: (record: OmpSourceRecord) => boolean,
): OmpSourceRecord | undefined {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];

    if (record && predicate(record)) {
      return record;
    }
  }

  return undefined;
}

function getMessage(record: OmpSourceRecord): UnknownRecord | undefined {
  const message = record.raw.message;

  return isRecord(message) ? message : undefined;
}

function getModel(records: OmpSourceRecord[]): string | undefined {
  const modelChange = findLastRecord(
    records,
    (record) =>
      record.type === "model_change" &&
      typeof record.raw.model === "string",
  );

  if (modelChange) {
    return modelChange.raw.model as string;
  }

  const assistantMessage = findLastRecord(records, (record) => {
    const message = getMessage(record);

    return (
      record.type === "message" &&
      message?.role === "assistant" &&
      typeof message.model === "string"
    );
  });

  if (!assistantMessage) {
    return undefined;
  }

  const message = getMessage(assistantMessage);
  const model = message ? readString(message, "model") : undefined;
  const provider = message ? readString(message, "provider") : undefined;

  if (!model || !provider || model.startsWith(`${provider}/`)) {
    return model;
  }

  return `${provider}/${model}`;
}

function buildSummary(records: OmpSourceRecord[]): OmpReplaySummary {
  const sessionRecord = records.find((record) => record.type === "session");
  const titleRecord = findLastRecord(
    records,
    (record) =>
      (record.type === "title" || record.type === "title_change") &&
      typeof record.raw.title === "string",
  );
  const completedRecord = findLastRecord(
    records,
    (record) =>
      record.type === "custom" && record.raw.customType === "session_exit",
  );
  const eventTypeCounts: Record<string, number> = {};
  const messageRoleCounts: Record<string, number> = {};
  let messageCount = 0;
  let toolCallCount = 0;
  let toolErrorCount = 0;

  for (const record of records) {
    incrementCount(eventTypeCounts, record.type);

    if (record.type !== "message") {
      continue;
    }

    messageCount += 1;

    const message = getMessage(record);
    const role = message ? readString(message, "role") : undefined;

    incrementCount(messageRoleCounts, role ?? "unknown");

    if (role === "toolResult" && message?.isError === true) {
      toolErrorCount += 1;
    }

    const content = message?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (isRecord(block) && block.type === "toolCall") {
        toolCallCount += 1;
      }
    }
  }

  return {
    sessionId:
      (sessionRecord && readString(sessionRecord.raw, "id")) ?? "unknown",
    formatVersion:
      sessionRecord && typeof sessionRecord.raw.version === "number"
        ? sessionRecord.raw.version
        : undefined,
    title:
      (titleRecord && readString(titleRecord.raw, "title")) ??
      (sessionRecord && readString(sessionRecord.raw, "title")) ??
      "Untitled OMP session",
    model: getModel(records),
    workspace: sessionRecord
      ? readString(sessionRecord.raw, "cwd")
      : undefined,
    startedAt: sessionRecord
      ? readTimestamp(sessionRecord.raw)
      : undefined,
    endedAt: completedRecord?.timestamp,
    status: completedRecord ? "completed" : "incomplete",
    recordCount: records.length,
    messageCount,
    toolCallCount,
    toolErrorCount,
    eventTypeCounts,
    messageRoleCounts,
  };
}

export function parseOmpJsonl(text: string): OmpImportResult {
  const issues: OmpImportIssue[] = [];
  const records: OmpSourceRecord[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim().length === 0) {
      return;
    }

    const lineNumber = index + 1;
    let input: unknown;

    try {
      input = JSON.parse(line);
    } catch {
      issues.push({
        lineNumber,
        message: "Expected one valid JSON object on this line.",
      });
      return;
    }

    if (!isRecord(input)) {
      issues.push({
        lineNumber,
        message: "Expected a JSON object.",
      });
      return;
    }

    const type = readString(input, "type");

    if (!type) {
      issues.push({
        lineNumber,
        message: "Expected a non-empty event type.",
      });
      return;
    }

    records.push({
      lineNumber,
      type,
      timestamp: readTimestamp(input),
      raw: input as JsonObject,
    });
  });

  if (issues.length > 0) {
    return { success: false, issues };
  }

  if (records.length === 0) {
    return {
      success: false,
      issues: [{ message: "The session file does not contain any records." }],
    };
  }

  const sessionRecord = records.find(
    (record) =>
      record.type === "session" && typeof record.raw.id === "string",
  );

  if (!sessionRecord) {
    return {
      success: false,
      issues: [
        {
          message:
            "This does not look like an OMP session. Expected a session record with an id.",
        },
      ],
    };
  }

  return {
    success: true,
    data: {
      format: "omp-jsonl",
      source: "omp",
      records,
      summary: buildSummary(records),
    },
  };
}
