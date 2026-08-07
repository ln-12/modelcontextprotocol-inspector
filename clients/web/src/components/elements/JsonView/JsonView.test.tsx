import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { JsonView, isHttpUrlString, normalizeJsonValue } from "./JsonView";

describe("normalizeJsonValue", () => {
  it("round-trips plain objects and arrays", () => {
    expect(normalizeJsonValue({ a: 1, b: [true, null] })).toEqual({
      a: 1,
      b: [true, null],
    });
  });

  it("turns undefined into null", () => {
    expect(normalizeJsonValue(undefined)).toBeNull();
  });
});

describe("isHttpUrlString", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrlString("https://example.com")).toBe(true);
    expect(isHttpUrlString("http://localhost:3000/a")).toBe(true);
  });

  it("rejects non-http schemes and non-URLs", () => {
    expect(isHttpUrlString("javascript:alert(1)")).toBe(false);
    expect(isHttpUrlString("not a url")).toBe(false);
    expect(isHttpUrlString("ftp://example.com")).toBe(false);
  });
});

describe("JsonView", () => {
  it("expands the root and first-level children by default", () => {
    renderWithMantine(
      <JsonView
        data={{ temperature: 65, unit: "F", nested: { city: "SF" } }}
        copyable={false}
      />,
    );
    expect(screen.getByText("temperature:")).toBeInTheDocument();
    expect(screen.getByText("unit:")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText('"F"')).toBeInTheDocument();
    // First-level `nested` object is open by default (depth 1 < 2).
    expect(screen.getByText("city:")).toBeInTheDocument();
    expect(screen.getByText('"SF"')).toBeInTheDocument();
  });

  it("starts depth-2 objects collapsed", () => {
    renderWithMantine(
      <JsonView
        data={{ nested: { inner: { deep: 1 } } }}
        copyable={false}
      />,
    );
    expect(screen.getByText("nested:")).toBeInTheDocument();
    expect(screen.getByText("inner:")).toBeInTheDocument();
    expect(screen.queryByText("deep:")).not.toBeInTheDocument();
    expect(screen.getByText("{ … }")).toBeInTheDocument();
  });

  it("expands a depth-2 object when its row is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <JsonView
        data={{ nested: { inner: { deep: 1 } } }}
        copyable={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Expand inner" }));
    expect(screen.getByText("deep:")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("collapses an expanded node on a second click", async () => {
    const user = userEvent.setup();
    renderWithMantine(<JsonView data={{ a: { b: 1 } }} copyable={false} />);
    expect(screen.getByText("b:")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse a" }));
    expect(screen.queryByText("b:")).not.toBeInTheDocument();
    expect(screen.getByText("{ … }")).toBeInTheDocument();
  });

  it("renders empty objects and arrays without a nested toggle", () => {
    renderWithMantine(
      <JsonView data={{ emptyObj: {}, emptyArr: [] }} copyable={false} />,
    );
    expect(screen.getByText("{}")).toBeInTheDocument();
    expect(screen.getByText("[]")).toBeInTheDocument();
    // Only the root object is expandable — empty children have no toggle.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /emptyObj|emptyArr/ }),
    ).not.toBeInTheDocument();
  });

  it("renders array items with index keys when the list is expanded by default", () => {
    renderWithMantine(
      <JsonView data={{ list: ["x", "y"] }} copyable={false} />,
    );
    expect(screen.getByText("0:")).toBeInTheDocument();
    expect(screen.getByText("1:")).toBeInTheDocument();
    expect(screen.getByText('"x"')).toBeInTheDocument();
    expect(screen.getByText('"y"')).toBeInTheDocument();
  });

  it("shows depth-1 long strings in full by default", () => {
    const long = "a".repeat(120);
    renderWithMantine(<JsonView data={{ note: long }} copyable={false} />);
    expect(screen.getByText(`"${long}"`)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Expand note" }),
    ).not.toBeInTheDocument();
  });

  it("truncates depth-2 long strings until expanded", async () => {
    const user = userEvent.setup();
    const long = "a".repeat(120);
    renderWithMantine(
      <JsonView data={{ outer: { note: long } }} copyable={false} />,
    );
    expect(screen.getByText(/"a{100}…"/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand note" }));
    expect(screen.getByText(`"${long}"`)).toBeInTheDocument();
  });

  it("renders http(s) strings as full links that open in a new tab", () => {
    const url = "https://example.com/path?q=1";
    const { container } = renderWithMantine(
      <JsonView data={{ homepage: url }} copyable={false} />,
    );
    const link = screen.getByRole("link", {
      name: `Open ${url} in a new tab`,
    });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Full URL is shown (never truncated), even when longer than the
    // long-string threshold.
    expect(link).toHaveTextContent(url);
    const copy = screen.getByRole("button", { name: "Copy homepage" });
    expect(copy).toBeInTheDocument();
    // Closing quote and copy share a nowrap suffix so they do not orphan.
    const suffix = container.querySelector(".json-url-suffix");
    expect(suffix).toContainElement(copy);
    expect(suffix?.textContent).toContain('"');
  });

  it("keeps long http(s) URLs fully expanded (no truncate toggle)", () => {
    const url = `https://example.com/${"a".repeat(120)}`;
    renderWithMantine(<JsonView data={{ href: url }} copyable={false} />);
    expect(
      screen.getByRole("link", { name: `Open ${url} in a new tab` }),
    ).toHaveTextContent(url);
    expect(
      screen.queryByRole("button", { name: "Expand href" }),
    ).not.toBeInTheDocument();
  });

  it("does not link non-http schemes", () => {
    renderWithMantine(
      <JsonView data={{ evil: "javascript:alert(1)" }} copyable={false} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText('"javascript:alert(1)"')).toBeInTheDocument();
  });

  it("renders null, boolean, and number primitives", () => {
    renderWithMantine(
      <JsonView data={{ n: null, ok: true, count: 3 }} copyable={false} />,
    );
    expect(screen.getByText("null")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("exposes a copy control when copyable", () => {
    renderWithMantine(<JsonView data={{ a: 1 }} />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("honors a lower initialExpandDepth to collapse first-level children", () => {
    renderWithMantine(
      <JsonView
        data={{ nested: { city: "SF" } }}
        initialExpandDepth={1}
        copyable={false}
      />,
    );
    expect(screen.queryByText("city:")).not.toBeInTheDocument();
    expect(screen.getByText("{ … }")).toBeInTheDocument();
  });
});
