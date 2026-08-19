import {
  Anchor,
  Flex,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useState, type ReactNode } from "react";
import { getDataType, type JsonValue } from "../../../utils/jsonUtils";
import { isHttpUrl } from "../../../lib/downloadFile";
import { CopyButton } from "../CopyButton/CopyButton";

export interface JsonViewProps {
  /** Any JSON-serializable value to render as an expandable tree. */
  data: unknown;
  /**
   * Nodes at depth `< initialExpandDepth` start open. Depth 0 is the root and
   * depth 1 its direct children, so the default of `2` expands both; deeper
   * nesting starts collapsed.
   */
  initialExpandDepth?: number;
  /** Optional root label (e.g. a property name when embedding a subtree). */
  rootName?: string;
  /** Show a copy-to-clipboard control for the entire value. Defaults to true. */
  copyable?: boolean;
}

const ViewWrapper = Flex.withProps({
  pos: "relative",
  direction: "column",
  ff: "monospace",
  fz: "sm",
});

const CopyOverlay = Flex.withProps({
  pos: "absolute",
  top: 4,
  right: 4,
});

const NodeStack = Stack.withProps({
  gap: 2,
});

const ChildrenStack = Stack.withProps({
  gap: 2,
  pl: "md",
  ml: "xs",
});

const NodeRow = Group.withProps({
  gap: "xs",
  wrap: "nowrap",
  align: "flex-start",
});

// Value cell for a URL row: only the anchor may wrap (`word-break` on `.json-url`).
// The closing quote and copy icon sit in a nowrap suffix so they stay on the
// URL's last line instead of breaking to a line of their own.
const UrlValueLine = Text.withProps({
  span: true,
  ff: "monospace",
  fz: "sm",
  flex: 1,
  miw: 0,
});

// Closing `"` plus copy control — must not wrap away from the link text.
const UrlSuffix = Text.withProps({
  span: true,
  variant: "jsonUrlSuffix",
});

// Clickable expand/collapse control for objects, arrays, and long strings.
// Hover background lives in App.css (`.json-node:hover`) via the theme variant.
const ExpandableRow = UnstyledButton.withProps({
  variant: "jsonNode",
  w: "100%",
});

const KeyText = Text.withProps({
  span: true,
  c: "dimmed",
  ff: "monospace",
  fz: "sm",
});

const PunctuationText = Text.withProps({
  span: true,
  c: "dimmed",
  ff: "monospace",
  fz: "sm",
});

const StringText = Text.withProps({
  span: true,
  c: "teal",
  ff: "monospace",
  fz: "sm",
  variant: "monoBreak",
});

// http(s) string values: always fully shown, open in a new tab on click.
// `target`/`rel` are static behavioral props (count toward `.withProps()`).
// `jsonUrl` theme variant applies word-break (see App.css `.json-url`).
const UrlAnchor = Anchor.withProps({
  variant: "jsonUrl",
  target: "_blank",
  rel: "noopener noreferrer",
  c: "teal",
  ff: "monospace",
  fz: "sm",
  underline: "hover",
});

const NumberText = Text.withProps({
  span: true,
  c: "blue",
  ff: "monospace",
  fz: "sm",
});

const BooleanText = Text.withProps({
  span: true,
  c: "yellow.7",
  ff: "monospace",
  fz: "sm",
});

const NullText = Text.withProps({
  span: true,
  c: "grape",
  ff: "monospace",
  fz: "sm",
});

const DefaultText = Text.withProps({
  span: true,
  c: "var(--inspector-text-primary)",
  ff: "monospace",
  fz: "sm",
});

const CountText = Text.withProps({
  span: true,
  c: "dimmed",
  ff: "monospace",
  fz: "sm",
});

/** Long strings truncate until clicked; matches v1's JsonView threshold. */
const LONG_STRING_THRESHOLD = 100;

/**
 * Coerce an arbitrary value into a {@link JsonValue} for the tree. Round-trips
 * through JSON so non-JSON values (undefined, functions, symbols) become
 * displayable rather than throwing in the renderer.
 */
export function normalizeJsonValue(data: unknown): JsonValue {
  if (data === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(data)) as JsonValue;
  } catch {
    return String(data);
  }
}

/**
 * Whether a JSON string value should render as a clickable http(s) link.
 * Thin wrapper over {@link isHttpUrl} so the tree can key off a boolean and
 * keep the original string for display (preserving what the server sent).
 */
export function isHttpUrlString(value: string): boolean {
  return isHttpUrl(value) !== null;
}

function formatCopyValue(data: unknown): string {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function KeyLabel({ name }: { name?: string }) {
  if (name === undefined) return null;
  return <KeyText>{name}:</KeyText>;
}

function PrimitiveValue({ data }: { data: JsonValue }) {
  const dataType = getDataType(data);
  switch (dataType) {
    case "string":
      return <StringText>&quot;{data as string}&quot;</StringText>;
    case "number":
      return <NumberText>{String(data)}</NumberText>;
    case "boolean":
      return <BooleanText>{String(data)}</BooleanText>;
    case "null":
      return <NullText>null</NullText>;
    default:
      return <DefaultText>{String(data)}</DefaultText>;
  }
}

function UrlStringValue({ value, name }: { value: string; name?: string }) {
  const copyLabel = name ? `Copy ${name}` : "Copy URL";
  return (
    <NodeRow>
      <KeyLabel name={name} />
      <UrlValueLine>
        <PunctuationText>&quot;</PunctuationText>
        <UrlAnchor href={value} aria-label={`Open ${value} in a new tab`}>
          {value}
        </UrlAnchor>
        <UrlSuffix>
          <PunctuationText>&quot;</PunctuationText>
          <CopyButton value={value} flush size="xs" label={copyLabel} />
        </UrlSuffix>
      </UrlValueLine>
    </NodeRow>
  );
}

function itemLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

interface JsonNodeProps {
  data: JsonValue;
  name?: string;
  depth: number;
  initialExpandDepth: number;
}

function JsonNode({ data, name, depth, initialExpandDepth }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < initialExpandDepth);
  const dataType = getDataType(data);

  if (dataType === "object" || dataType === "array") {
    const isArray = dataType === "array";
    const entries = isArray
      ? (data as JsonValue[]).map((value, index): [string, JsonValue] => [
          String(index),
          value,
        ])
      : Object.entries(data as Record<string, JsonValue>);
    const count = entries.length;
    const open = isArray ? "[" : "{";
    const close = isArray ? "]" : "}";
    const empty = isArray ? "[]" : "{}";
    const collapsed = isArray ? "[ … ]" : "{ … }";

    if (count === 0) {
      return (
        <NodeRow>
          <KeyLabel name={name} />
          <PunctuationText>{empty}</PunctuationText>
        </NodeRow>
      );
    }

    const summary: ReactNode = expanded ? (
      <PunctuationText>{open}</PunctuationText>
    ) : (
      <>
        <PunctuationText>{collapsed}</PunctuationText>
        <CountText>{itemLabel(count)}</CountText>
      </>
    );

    return (
      <NodeStack>
        <ExpandableRow
          aria-expanded={expanded}
          aria-label={
            name
              ? `${expanded ? "Collapse" : "Expand"} ${name}`
              : expanded
                ? "Collapse"
                : "Expand"
          }
          onClick={() => setExpanded((openState) => !openState)}
        >
          <NodeRow>
            <KeyLabel name={name} />
            {summary}
          </NodeRow>
        </ExpandableRow>
        {expanded && (
          <>
            <ChildrenStack>
              {entries.map(([key, value]) => (
                <JsonNode
                  key={key}
                  data={value}
                  name={key}
                  depth={depth + 1}
                  initialExpandDepth={initialExpandDepth}
                />
              ))}
            </ChildrenStack>
            <PunctuationText>{close}</PunctuationText>
          </>
        )}
      </NodeStack>
    );
  }

  if (dataType === "string") {
    const value = data as string;
    // http(s) URLs are never truncated — always fully shown as a link.
    if (isHttpUrlString(value)) {
      return <UrlStringValue value={value} name={name} />;
    }
    const tooLong = value.length > LONG_STRING_THRESHOLD;
    if (!tooLong) {
      return (
        <NodeRow>
          <KeyLabel name={name} />
          <PrimitiveValue data={value} />
        </NodeRow>
      );
    }
    const display = expanded
      ? value
      : `${value.slice(0, LONG_STRING_THRESHOLD)}…`;
    return (
      <ExpandableRow
        aria-expanded={expanded}
        aria-label={
          name
            ? `${expanded ? "Collapse" : "Expand"} ${name}`
            : expanded
              ? "Collapse string"
              : "Expand string"
        }
        onClick={() => setExpanded((openState) => !openState)}
      >
        <NodeRow>
          <KeyLabel name={name} />
          <StringText>&quot;{display}&quot;</StringText>
        </NodeRow>
      </ExpandableRow>
    );
  }

  return (
    <NodeRow>
      <KeyLabel name={name} />
      <PrimitiveValue data={data} />
    </NodeRow>
  );
}

/**
 * Interactive JSON tree: objects/arrays (and long strings) collapse and expand
 * by node. http(s) string values render as links that open in a new tab.
 * Used by the Tools Results panel for `structuredContent` and result `_meta`.
 */
export function JsonView({
  data,
  initialExpandDepth = 2,
  rootName,
  copyable = true,
}: JsonViewProps) {
  const normalized = normalizeJsonValue(data);
  const copyValue = formatCopyValue(normalized);

  return (
    <ViewWrapper>
      <JsonNode
        data={normalized}
        name={rootName}
        depth={0}
        initialExpandDepth={initialExpandDepth}
      />
      {copyable && (
        <CopyOverlay>
          <CopyButton value={copyValue} />
        </CopyOverlay>
      )}
    </ViewWrapper>
  );
}
