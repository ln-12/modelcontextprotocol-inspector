import {
  ActionIcon,
  CopyButton as MantineCopyButton,
  Tooltip,
} from "@mantine/core";

export interface CopyButtonProps {
  value: string;
  /**
   * Drop ActionIcon padding/height so the glyph top-aligns in tight aside
   * rows (e.g. beside a Code block). Icon size is unchanged.
   */
  flush?: boolean;
  /** ActionIcon size. Defaults to Mantine's `md`. Use `xs` for inline rows. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Accessible name for the control. Defaults to "Copy" / "Copied". Pass a
   * distinct label when several copy buttons share a region (e.g. per-URL
   * copies beside a tree-wide copy).
   */
  label?: string;
}

const CopyActionIcon = ActionIcon.withProps({
  variant: "subtle",
});

export function CopyButton({
  value,
  flush = false,
  size,
  label = "Copy",
}: CopyButtonProps) {
  const copiedLabel = label === "Copy" ? "Copied" : `${label} — copied`;
  return (
    <MantineCopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied" : label}>
          <CopyActionIcon
            size={size}
            // The unicode glyph needs an explicit font-size; keep the original
            // 24 for the default control, shrink for inline `xs` URL copies.
            fz={size === "xs" ? 14 : 24}
            color={copied ? "green" : "var(--inspector-text-primary)"}
            onClick={copy}
            aria-label={copied ? copiedLabel : label}
            {...(flush && { p: 0, h: "auto", w: "auto" })}
          >
            {copied ? "\u2713" : "\u2398"}
          </CopyActionIcon>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
}
