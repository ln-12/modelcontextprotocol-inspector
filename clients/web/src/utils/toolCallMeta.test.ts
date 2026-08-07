import { describe, it, expect } from "vitest";
import { parseToolCallMeta } from "./toolCallMeta";

describe("parseToolCallMeta", () => {
  it("treats an empty editor as no metadata", () => {
    expect(parseToolCallMeta("")).toEqual({ ok: true, meta: undefined });
  });

  it("treats a whitespace-only editor as no metadata", () => {
    expect(parseToolCallMeta("  \n\t ")).toEqual({ ok: true, meta: undefined });
  });

  it("parses a flat object of string values", () => {
    expect(parseToolCallMeta('{"progressToken":"abc"}')).toEqual({
      ok: true,
      meta: { progressToken: "abc" },
    });
  });

  it("preserves nested objects, arrays, numbers, booleans, and null", () => {
    const text = JSON.stringify({
      "acme.dev/trace": {
        id: 7,
        tags: ["a", "b"],
        sampled: true,
        parent: null,
      },
    });
    expect(parseToolCallMeta(text)).toEqual({
      ok: true,
      meta: {
        "acme.dev/trace": {
          id: 7,
          tags: ["a", "b"],
          sampled: true,
          parent: null,
        },
      },
    });
  });

  it("accepts an explicit empty object", () => {
    expect(parseToolCallMeta("{}")).toEqual({ ok: true, meta: {} });
  });

  it("reports the parser's message for malformed JSON", () => {
    const result = parseToolCallMeta("{ not json");
    expect(result.ok).toBe(false);
    // The exact wording is the engine's; assert only that something explanatory
    // came back rather than pinning a V8-specific string.
    expect(result.ok === false && result.error.length > 0).toBe(true);
  });

  it.each([
    ["an array", "[1, 2]"],
    ["a string", '"hello"'],
    ["a number", "42"],
    ["null", "null"],
  ])("rejects %s at the top level", (_label, text) => {
    const result = parseToolCallMeta(text);
    expect(result).toEqual({
      ok: false,
      error: 'Metadata must be a JSON object, e.g. { "key": "value" }',
    });
  });
});
