import { describe, it, expect, vi, afterEach } from "vitest";
import {
  clearToolInput,
  loadToolInput,
  mergeStoredFormValues,
  saveToolInput,
} from "./toolInputStore";

const KEY = "inspector.toolInputs.demo";

function storedFor(serverId: string): unknown {
  const raw = window.localStorage.getItem(`inspector.toolInputs.${serverId}`);
  return raw === null ? null : JSON.parse(raw);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toolInputStore", () => {
  it("returns undefined when nothing is stored for the tool", () => {
    expect(loadToolInput("demo", "echo")).toBeUndefined();
  });

  it("round-trips a tool's form values and metadata text", () => {
    saveToolInput("demo", "echo", {
      formValues: { message: "hi" },
      metaText: '{"tenant":"acme"}',
    });
    expect(loadToolInput("demo", "echo")).toEqual({
      formValues: { message: "hi" },
      metaText: '{"tenant":"acme"}',
    });
  });

  it("scopes saved inputs by server and by tool", () => {
    saveToolInput("demo", "echo", { formValues: { a: 1 }, metaText: "" });
    saveToolInput("other", "echo", { formValues: { a: 2 }, metaText: "" });
    saveToolInput("demo", "add", { formValues: { a: 3 }, metaText: "" });
    expect(loadToolInput("demo", "echo")?.formValues).toEqual({ a: 1 });
    expect(loadToolInput("other", "echo")?.formValues).toEqual({ a: 2 });
    expect(loadToolInput("demo", "add")?.formValues).toEqual({ a: 3 });
  });

  it("keeps other tools' inputs when one is overwritten", () => {
    saveToolInput("demo", "echo", { formValues: { a: 1 }, metaText: "" });
    saveToolInput("demo", "add", { formValues: { b: 1 }, metaText: "" });
    saveToolInput("demo", "echo", { formValues: { a: 9 }, metaText: "" });
    expect(loadToolInput("demo", "echo")?.formValues).toEqual({ a: 9 });
    expect(loadToolInput("demo", "add")?.formValues).toEqual({ b: 1 });
  });

  it("removes the entry instead of storing an empty one", () => {
    saveToolInput("demo", "echo", { formValues: { a: 1 }, metaText: "" });
    saveToolInput("demo", "add", { formValues: { b: 1 }, metaText: "" });
    saveToolInput("demo", "echo", { formValues: {}, metaText: "   " });
    expect(storedFor("demo")).toEqual({
      add: { formValues: { b: 1 }, metaText: "" },
    });
  });

  it("drops the server's key once its last tool is cleared", () => {
    saveToolInput("demo", "echo", { formValues: { a: 1 }, metaText: "" });
    clearToolInput("demo", "echo");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("treats a metadata-only input as worth keeping", () => {
    saveToolInput("demo", "echo", { formValues: {}, metaText: '{"a":1}' });
    expect(loadToolInput("demo", "echo")).toEqual({
      formValues: {},
      metaText: '{"a":1}',
    });
  });

  it("ignores a corrupt stored value", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadToolInput("demo", "echo")).toBeUndefined();
  });

  it("ignores a stored value that isn't an object", () => {
    window.localStorage.setItem(KEY, "[1,2]");
    expect(loadToolInput("demo", "echo")).toBeUndefined();
  });

  it("ignores an entry that isn't an object", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ echo: "nope" }));
    expect(loadToolInput("demo", "echo")).toBeUndefined();
  });

  it("falls back to empty fields when an entry's shape is wrong", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ echo: { formValues: "nope", metaText: 7 } }),
    );
    expect(loadToolInput("demo", "echo")).toEqual({
      formValues: {},
      metaText: "",
    });
  });

  it("returns undefined when reading storage throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(loadToolInput("demo", "echo")).toBeUndefined();
  });

  it("swallows a failing write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() =>
      saveToolInput("demo", "echo", { formValues: { a: 1 }, metaText: "" }),
    ).not.toThrow();
  });
});

describe("mergeStoredFormValues", () => {
  const schema = {
    type: "object" as const,
    properties: {
      mode: { type: "string" as const },
      count: { type: "number" as const },
    },
  };

  it("lays stored values over the schema defaults", () => {
    expect(
      mergeStoredFormValues({ mode: "fast", count: 1 }, { count: 5 }, schema),
    ).toEqual({ mode: "fast", count: 5 });
  });

  it("drops stored keys the schema no longer declares", () => {
    expect(
      mergeStoredFormValues({}, { mode: "slow", removed: "x" }, schema),
    ).toEqual({ mode: "slow" });
  });

  it("keeps every stored key when the schema declares no properties", () => {
    expect(
      mergeStoredFormValues({}, { anything: 1 }, { type: "object" }),
    ).toEqual({ anything: 1 });
  });
});
