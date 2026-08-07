import type { InspectorFormSchema } from "../utils/jsonUtils";

/**
 * A tool's remembered inputs: the arguments form and the raw text of the
 * per-call `_meta` editor. `metaText` is stored as text rather than a parsed
 * object so a half-typed value survives a reload the same way it survives a
 * re-render (see `parseToolCallMeta`).
 */
export interface StoredToolInput {
  formValues: Record<string, unknown>;
  metaText: string;
}

// One localStorage entry per server, holding a tool-name → inputs map. Scoping
// by server id matters because the same tool name means different things on two
// servers; the id is the `mcp.json` key, stable across restarts and reconnects
// (unlike a URL, which stdio servers don't have at all).
const KEY_PREFIX = "inspector.toolInputs.";

function storageKey(serverId: string): string {
  return `${KEY_PREFIX}${serverId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Everything persisted for one server, or `{}` when there is nothing usable
 * there. Storage is treated as untrusted input throughout: it outlives the code
 * that wrote it, so a shape from an older build (or a hand-edited value) must
 * degrade to "no saved input" instead of throwing on a tool selection.
 */
function readServerRecord(serverId: string): Record<string, unknown> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(serverId));
  } catch {
    // Storage can be unavailable outright (Safari private mode, blocked
    // cookies). Remembering inputs is a convenience, never a reason to break
    // the Tools tab.
    return {};
  }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeServerRecord(
  serverId: string,
  record: Record<string, unknown>,
): void {
  try {
    if (Object.keys(record).length === 0) {
      window.localStorage.removeItem(storageKey(serverId));
      return;
    }
    window.localStorage.setItem(storageKey(serverId), JSON.stringify(record));
  } catch {
    // Quota exceeded, or storage blocked. Dropping the write is the right
    // failure mode — the in-memory form state the user is editing is untouched.
  }
}

function isEmpty(input: StoredToolInput): boolean {
  return (
    Object.keys(input.formValues).length === 0 && input.metaText.trim() === ""
  );
}

/** The saved inputs for one tool, or `undefined` when nothing is stored. */
export function loadToolInput(
  serverId: string,
  toolName: string,
): StoredToolInput | undefined {
  const entry = readServerRecord(serverId)[toolName];
  if (!isPlainObject(entry)) return undefined;
  return {
    formValues: isPlainObject(entry.formValues) ? entry.formValues : {},
    metaText: typeof entry.metaText === "string" ? entry.metaText : "",
  };
}

/**
 * Persist one tool's inputs, replacing whatever was stored for it. An input
 * with no form values and no metadata is removed rather than written, so
 * clearing a tool's form doesn't leave an empty husk behind (and the last one
 * removed drops the server's entry entirely).
 */
export function saveToolInput(
  serverId: string,
  toolName: string,
  input: StoredToolInput,
): void {
  const record = readServerRecord(serverId);
  if (isEmpty(input)) {
    delete record[toolName];
  } else {
    record[toolName] = input;
  }
  writeServerRecord(serverId, record);
}

/** Forget one tool's saved inputs. */
export function clearToolInput(serverId: string, toolName: string): void {
  saveToolInput(serverId, toolName, { formValues: {}, metaText: "" });
}

/**
 * Seed a tool's form from its schema defaults, then lay the saved values over
 * the top. Merging (rather than using the saved object wholesale) means a field
 * the server has since added still arrives with its default.
 *
 * Saved keys the schema no longer declares are dropped: a tool's schema can
 * change between sessions, and sending an argument the server has removed is
 * worse than losing a value the form can't render anyway. A schema with no
 * `properties` declares nothing to check against, so everything is kept.
 */
export function mergeStoredFormValues(
  defaults: Record<string, unknown>,
  stored: Record<string, unknown>,
  schema: InspectorFormSchema,
): Record<string, unknown> {
  const { properties } = schema;
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    if (properties && !(key in properties)) continue;
    merged[key] = value;
  }
  return merged;
}
