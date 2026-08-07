import { Anchor } from "@mantine/core";

export const ThemeAnchor = Anchor.extend({
  classNames: (_theme, props) => {
    // JsonView http(s) string links — word-break lives in App.css (`.json-url`)
    // because it isn't expressible as a flat Styles-API property alone in a
    // way that also covers long path segments without spaces.
    if (props.variant === "jsonUrl") return { root: "json-url" };
    return {};
  },
});
