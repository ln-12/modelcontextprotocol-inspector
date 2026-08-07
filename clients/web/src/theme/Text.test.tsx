import { describe, it, expect } from "vitest";
import { Text } from "@mantine/core";
import { renderWithMantine } from "../test/renderWithMantine";

describe("ThemeText", () => {
  it('applies the json-url-suffix class only to the "jsonUrlSuffix" variant', () => {
    const { getByText } = renderWithMantine(
      <Text variant="jsonUrlSuffix">tail</Text>,
    );
    expect(getByText("tail").className).toContain("json-url-suffix");
  });
});
