import { describe, it, expect } from "vitest";
import { Anchor } from "@mantine/core";
import { renderWithMantine } from "../test/renderWithMantine";

describe("ThemeAnchor", () => {
  it('applies the json-url class only to the "jsonUrl" variant', () => {
    const { getByText } = renderWithMantine(
      <Anchor variant="jsonUrl" href="https://example.com">
        link
      </Anchor>,
    );
    expect(getByText("link").className).toContain("json-url");
  });

  it("does not apply json-url to the default Anchor", () => {
    const { getByText } = renderWithMantine(
      <Anchor href="https://example.com">link</Anchor>,
    );
    expect(getByText("link").className).not.toContain("json-url");
  });
});
