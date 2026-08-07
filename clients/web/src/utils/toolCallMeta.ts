import type { JsonObject } from "@inspector/core/json/jsonUtils.js";

/**
 * Outcome of parsing the Tools tab's `_meta` editor. `meta` is `undefined` for
 * an empty editor, which is distinct from `{}` — an empty object would put a
 * bare `_meta: {}` on the wire, and the client omits `_meta` entirely when there
 * is nothing to send.
 */
export type ToolCallMetaParseResult =
  | { ok: true; meta: JsonObject | undefined }
  | { ok: false; error: string };

/**
 * Parse the user-authored `_meta` for a `tools/call`.
 *
 * `_meta` is an open object in the MCP spec: keys are strings, values are any
 * JSON. So the editor accepts a whole JSON object rather than key/value string
 * pairs (which is what server-wide `metadata` in the server settings offers) —
 * an inspector has to be able to send the nested shapes real extensions use.
 *
 * A top-level array, string, or number parses as valid JSON but is not a legal
 * `_meta`, so those are rejected here rather than sent and refused by the
 * server.
 */
export function parseToolCallMeta(text: string): ToolCallMetaParseResult {
  if (text.trim() === "") {
    return { ok: true, meta: undefined };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      // `JSON.parse` rejects only with a SyntaxError, whose message names the
      // offending position — worth surfacing verbatim.
      /* v8 ignore next -- unreachable: JSON.parse never throws a non-Error */
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'Metadata must be a JSON object, e.g. { "key": "value" }',
    };
  }
  // Safe single cast: JSON.parse only ever yields JSON values, and the guard
  // above has narrowed this one to a non-null, non-array object.
  return { ok: true, meta: parsed as JsonObject };
}
