import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { CallToolResult } from "@modelcontextprotocol/client";
import {
  renderWithMantine,
  screen,
  waitFor,
} from "../../../test/renderWithMantine";
import { ToolResultPanel } from "./ToolResultPanel";
import {
  resultHasMeta,
  resultHasResourceLinks,
  resultHasStructuredContent,
} from "./toolResultUtils";

const okResult: CallToolResult = {
  content: [{ type: "text", text: "ok" }],
  isError: false,
};

const errorResult: CallToolResult = {
  content: [{ type: "text", text: "boom" }],
  isError: true,
};

const emptyResult: CallToolResult = { content: [] };

const structuredOnlyResult: CallToolResult = {
  content: [],
  structuredContent: { temperature: 65, unit: "F", city: "SF" },
};

const structuredWithContentResult: CallToolResult = {
  content: [
    {
      type: "text",
      text: "The current weather in SF is 65°F.",
    },
  ],
  structuredContent: { temperature: 65, unit: "F", city: "SF" },
};

const metaOnlyResult: CallToolResult = {
  content: [],
  _meta: { "acme.dev/traceId": "tr_abc", progressToken: "p-1" },
};

const fullResult: CallToolResult = {
  content: [
    {
      type: "text",
      text: "The current weather in SF is 65°F.",
    },
  ],
  structuredContent: { temperature: 65, unit: "F", city: "SF" },
  _meta: { "acme.dev/traceId": "tr_abc" },
};

describe("ToolResultPanel", () => {
  it("renders text content blocks", () => {
    renderWithMantine(<ToolResultPanel result={okResult} onClear={() => {}} />);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders an error alert when isError is true", () => {
    renderWithMantine(
      <ToolResultPanel result={errorResult} onClear={() => {}} />,
    );
    expect(screen.getByText("Tool Error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders the empty state when content is empty", () => {
    renderWithMantine(
      <ToolResultPanel result={emptyResult} onClear={() => {}} />,
    );
    expect(screen.getByText("No results yet")).toBeInTheDocument();
  });

  it("renders structuredContent as a JSON section when present alone", () => {
    renderWithMantine(
      <ToolResultPanel result={structuredOnlyResult} onClear={() => {}} />,
    );
    expect(
      screen.getByRole("heading", { name: "Structured Content" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No results yet")).toBeNull();
    // Expandable JsonView shows top-level keys by default.
    expect(screen.getByText("temperature:")).toBeInTheDocument();
    expect(screen.getByText("unit:")).toBeInTheDocument();
    // No unlabeled content run → no "Content" heading.
    expect(
      screen.queryByRole("heading", { name: "Content" }),
    ).not.toBeInTheDocument();
  });

  it("labels both sections when structuredContent and content coexist", () => {
    renderWithMantine(
      <ToolResultPanel
        result={structuredWithContentResult}
        onClear={() => {}}
      />,
    );
    const contentHeading = screen.getByRole("heading", { name: "Content" });
    const structuredHeading = screen.getByRole("heading", {
      name: "Structured Content",
    });
    expect(contentHeading).toBeInTheDocument();
    expect(structuredHeading).toBeInTheDocument();
    // Content precedes Structured Content in document order.
    expect(
      contentHeading.compareDocumentPosition(structuredHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("The current weather in SF is 65°F."),
    ).toBeInTheDocument();
    expect(screen.getByText("city:")).toBeInTheDocument();
  });

  it("lets nested structuredContent nodes collapse and re-expand", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <ToolResultPanel
        result={{
          content: [],
          structuredContent: {
            location: { city: "SF", unit: "F" },
            temperature: 65,
          },
        }}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText("temperature:")).toBeInTheDocument();
    expect(screen.getByText("city:")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse location" }));
    expect(screen.queryByText("city:")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand location" }));
    expect(screen.getByText("city:")).toBeInTheDocument();
  });

  it("does not show structuredContent on an error result", () => {
    renderWithMantine(
      <ToolResultPanel
        result={{
          isError: true,
          content: [{ type: "text", text: "boom" }],
          structuredContent: { ignored: true },
        }}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText("Tool Error")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Structured Content" }),
    ).not.toBeInTheDocument();
  });

  it("renders _meta as a JSON section when present alone", () => {
    renderWithMantine(
      <ToolResultPanel result={metaOnlyResult} onClear={() => {}} />,
    );
    expect(
      screen.getByRole("heading", { name: "Metadata (_meta)" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No results yet")).toBeNull();
    expect(screen.getByText("acme.dev/traceId:")).toBeInTheDocument();
    expect(screen.getByText("progressToken:")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Content" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Structured Content" }),
    ).not.toBeInTheDocument();
  });

  it("places Metadata (_meta) below Structured Content when both exist", () => {
    renderWithMantine(
      <ToolResultPanel result={fullResult} onClear={() => {}} />,
    );
    const contentHeading = screen.getByRole("heading", { name: "Content" });
    const structuredHeading = screen.getByRole("heading", {
      name: "Structured Content",
    });
    const metaHeading = screen.getByRole("heading", {
      name: "Metadata (_meta)",
    });
    expect(
      contentHeading.compareDocumentPosition(structuredHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      structuredHeading.compareDocumentPosition(metaHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("city:")).toBeInTheDocument();
    expect(screen.getByText("acme.dev/traceId:")).toBeInTheDocument();
  });

  it("labels Content when only _meta accompanies content blocks", () => {
    renderWithMantine(
      <ToolResultPanel
        result={{
          content: [{ type: "text", text: "ok" }],
          _meta: { "acme.dev/traceId": "tr_1" },
        }}
        onClear={() => {}}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Content" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Metadata (_meta)" }),
    ).toBeInTheDocument();
  });

  it("does not show _meta on an error result", () => {
    renderWithMantine(
      <ToolResultPanel
        result={{
          isError: true,
          content: [{ type: "text", text: "boom" }],
          _meta: { ignored: true },
        }}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText("Tool Error")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Metadata (_meta)" }),
    ).not.toBeInTheDocument();
  });

  it("groups resource_link blocks in a scrollable Resource Links box", async () => {
    const user = userEvent.setup();
    const onReadResource = vi.fn().mockResolvedValue({
      contents: [{ uri: "demo://r/1", text: "linked body" }],
    });
    const result: CallToolResult = {
      content: [
        { type: "text", text: "ok" },
        { type: "resource_link", uri: "demo://r/1", name: "Linked" },
      ],
    };
    renderWithMantine(
      <ToolResultPanel
        result={result}
        onClear={() => {}}
        onReadResource={onReadResource}
      />,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
    // The link sits inside a grouped, labeled box.
    expect(
      screen.getByRole("heading", { name: "Resource Links" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Expand resource demo://r/1" }),
    );
    expect(onReadResource).toHaveBeenCalledWith("demo://r/1");
    await waitFor(() =>
      expect(screen.getByText(/"linked body"/)).toBeInTheDocument(),
    );
  });

  it("collapses consecutive resource_link blocks into a single box", () => {
    const result: CallToolResult = {
      content: [
        { type: "text", text: "intro" },
        { type: "resource_link", uri: "demo://r/1", name: "One" },
        { type: "resource_link", uri: "demo://r/2", name: "Two" },
        { type: "resource_link", uri: "demo://r/3", name: "Three" },
      ],
    };
    renderWithMantine(<ToolResultPanel result={result} onClear={() => {}} />);
    // One shared "Resource Links" heading for the whole run of links.
    expect(
      screen.getAllByRole("heading", { name: "Resource Links" }),
    ).toHaveLength(1);
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("renders a separate Resource Links box per non-adjacent run", () => {
    const result: CallToolResult = {
      content: [
        { type: "resource_link", uri: "demo://r/1", name: "One" },
        { type: "text", text: "divider" },
        { type: "resource_link", uri: "demo://r/2", name: "Two" },
      ],
    };
    renderWithMantine(<ToolResultPanel result={result} onClear={() => {}} />);
    // The text block between the two links splits them into two boxes.
    expect(
      screen.getAllByRole("heading", { name: "Resource Links" }),
    ).toHaveLength(2);
    expect(screen.getByText("divider")).toBeInTheDocument();
  });

  it("invokes onClear when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    renderWithMantine(<ToolResultPanel result={okResult} onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: "Close results" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  describe("resultHasResourceLinks", () => {
    it("is true only for a non-error result containing a resource_link", () => {
      expect(
        resultHasResourceLinks({
          content: [
            { type: "text", text: "ok" },
            { type: "resource_link", uri: "demo://r/1", name: "Linked" },
          ],
        }),
      ).toBe(true);
    });

    it("is false for a text-only result", () => {
      expect(resultHasResourceLinks(okResult)).toBe(false);
    });

    it("is false for an empty result", () => {
      expect(resultHasResourceLinks(emptyResult)).toBe(false);
    });

    it("is false when the result is an error, even with a resource_link", () => {
      expect(
        resultHasResourceLinks({
          isError: true,
          content: [
            { type: "resource_link", uri: "demo://r/1", name: "Linked" },
          ],
        }),
      ).toBe(false);
    });
  });

  describe("resultHasStructuredContent", () => {
    it("is true when structuredContent is present on a success result", () => {
      expect(resultHasStructuredContent(structuredOnlyResult)).toBe(true);
      expect(resultHasStructuredContent(structuredWithContentResult)).toBe(
        true,
      );
    });

    it("is false when structuredContent is absent", () => {
      expect(resultHasStructuredContent(okResult)).toBe(false);
      expect(resultHasStructuredContent(emptyResult)).toBe(false);
    });

    it("is false when the result is an error, even with structuredContent", () => {
      expect(
        resultHasStructuredContent({
          isError: true,
          content: [{ type: "text", text: "boom" }],
          structuredContent: { ignored: true },
        }),
      ).toBe(false);
    });
  });

  describe("resultHasMeta", () => {
    it("is true when _meta is present on a success result", () => {
      expect(resultHasMeta(metaOnlyResult)).toBe(true);
      expect(resultHasMeta(fullResult)).toBe(true);
    });

    it("is false when _meta is absent", () => {
      expect(resultHasMeta(okResult)).toBe(false);
      expect(resultHasMeta(emptyResult)).toBe(false);
      expect(resultHasMeta(structuredOnlyResult)).toBe(false);
    });

    it("is false when the result is an error, even with _meta", () => {
      expect(
        resultHasMeta({
          isError: true,
          content: [{ type: "text", text: "boom" }],
          _meta: { ignored: true },
        }),
      ).toBe(false);
    });
  });
});
