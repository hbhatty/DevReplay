"use client";

import { z } from "zod";

import type {
  JsonValue,
  OmpReplay,
  OmpReplaySummary,
  OmpTimelineEvent,
} from "@/lib/replay/omp";

const DATABASE_NAME = "devreplay";
const DATABASE_VERSION = 1;
const SESSION_STORE = "sessions";
const CURRENT_SESSION_KEY = "current";
const STORAGE_FORMAT_VERSION = 1;
const MAX_STORED_BYTES = 12 * 1024 * 1024;
const MAX_TIMELINE_EVENTS = 20_000;
const MAX_EVENT_TEXT_LENGTH = 5 * 1024 * 1024;

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const CountMapSchema = z
  .record(z.string().max(200), z.number().int().nonnegative())
  .refine((counts) => Object.keys(counts).length <= 1_000);

const ReplaySummarySchema: z.ZodType<OmpReplaySummary> = z
  .object({
    sessionId: z.string().min(1).max(500),
    formatVersion: z.number().int().nonnegative().optional(),
    title: z.string().min(1).max(10_000),
    model: z.string().max(1_000).optional(),
    workspace: z.string().max(10_000).optional(),
    startedAt: z.string().max(100).optional(),
    endedAt: z.string().max(100).optional(),
    status: z.enum(["completed", "incomplete"]),
    recordCount: z.number().int().nonnegative(),
    messageCount: z.number().int().nonnegative(),
    toolCallCount: z.number().int().nonnegative(),
    toolErrorCount: z.number().int().nonnegative(),
    eventTypeCounts: CountMapSchema,
    messageRoleCounts: CountMapSchema,
  })
  .strict();

const TimelineEventSchema: z.ZodType<OmpTimelineEvent> = z
  .object({
    id: z.string().min(1).max(500),
    lineNumber: z.number().int().positive(),
    kind: z.enum([
      "session_started",
      "session_completed",
      "user_message",
      "assistant_message",
      "instruction",
      "tool_call",
      "tool_result",
      "model_change",
    ]),
    actor: z.enum(["User", "Model", "Tool", "OMP"]),
    label: z.string().min(1).max(10_000),
    timestamp: z.string().max(100).optional(),
    text: z.string().max(MAX_EVENT_TEXT_LENGTH).optional(),
    details: JsonValueSchema.optional(),
    isError: z.boolean().optional(),
  })
  .strict();

const StoredReplaySchema = z
  .object({
    version: z.literal(STORAGE_FORMAT_VERSION),
    fileName: z.string().min(1).max(1_000),
    savedAt: z.string().datetime(),
    replay: z
      .object({
        format: z.literal("omp-jsonl"),
        source: z.literal("omp"),
        summary: ReplaySummarySchema,
        timeline: z.array(TimelineEventSchema).max(MAX_TIMELINE_EVENTS),
      })
      .strict(),
  })
  .strict()
  .superRefine((stored, context) => {
    const eventIds = new Set<string>();

    for (const event of stored.replay.timeline) {
      if (eventIds.has(event.id)) {
        context.addIssue({
          code: "custom",
          message: "Stored timeline event IDs must be unique.",
        });
        return;
      }

      eventIds.add(event.id);
    }
  });

type StoredReplayEnvelope = z.infer<typeof StoredReplaySchema>;

export interface StoredReplay {
  fileName: string;
  savedAt: string;
  replay: OmpReplay;
}

export type StoredReplayLoadResult =
  | { status: "empty" }
  | { status: "loaded"; data: StoredReplay }
  | { status: "discarded" };

function serializedByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("Browser storage is unavailable."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Storage failed."));
    request.onblocked = () =>
      reject(new Error("Browser storage is blocked by another DevReplay tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Storage failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Storage failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Storage was cancelled."));
  });
}

function createEnvelope(fileName: string, replay: OmpReplay) {
  const envelope: StoredReplayEnvelope = {
    version: STORAGE_FORMAT_VERSION,
    fileName,
    savedAt: new Date().toISOString(),
    replay: {
      format: replay.format,
      source: replay.source,
      summary: replay.summary,
      timeline: replay.timeline,
    },
  };

  return StoredReplaySchema.parse(envelope);
}

export async function saveStoredReplay(fileName: string, replay: OmpReplay) {
  const envelope = createEnvelope(fileName, replay);

  if (serializedByteLength(envelope) > MAX_STORED_BYTES) {
    throw new Error("This normalized session is too large to save locally.");
  }

  const database = await openDatabase();

  try {
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(SESSION_STORE).put(envelope, CURRENT_SESSION_KEY);
    await completion;
  } finally {
    database.close();
  }

  return envelope.savedAt;
}

export async function deleteStoredReplay() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(SESSION_STORE).delete(CURRENT_SESSION_KEY);
    await completion;
  } finally {
    database.close();
  }
}

export async function loadStoredReplay(): Promise<StoredReplayLoadResult> {
  const database = await openDatabase();
  let value: unknown;

  try {
    const transaction = database.transaction(SESSION_STORE, "readonly");
    const completion = transactionComplete(transaction);
    value = await requestResult(
      transaction.objectStore(SESSION_STORE).get(CURRENT_SESSION_KEY),
    );
    await completion;
  } finally {
    database.close();
  }

  if (value === undefined) {
    return { status: "empty" };
  }

  let isWithinSizeLimit = false;

  try {
    isWithinSizeLimit = serializedByteLength(value) <= MAX_STORED_BYTES;
  } catch {
    isWithinSizeLimit = false;
  }

  const result = isWithinSizeLimit
    ? StoredReplaySchema.safeParse(value)
    : null;

  if (!result?.success) {
    await deleteStoredReplay();
    return { status: "discarded" };
  }

  return {
    status: "loaded",
    data: {
      fileName: result.data.fileName,
      savedAt: result.data.savedAt,
      replay: {
        ...result.data.replay,
        records: [],
      },
    },
  };
}
