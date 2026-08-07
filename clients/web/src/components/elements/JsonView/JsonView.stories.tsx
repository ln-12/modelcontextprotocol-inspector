import type { Meta, StoryObj } from "@storybook/react-vite";
import { JsonView } from "./JsonView";

const meta: Meta<typeof JsonView> = {
  title: "Elements/JsonView",
  component: JsonView,
};

export default meta;
type Story = StoryObj<typeof JsonView>;

export const FlatObject: Story = {
  args: {
    data: {
      temperature: 65,
      unit: "fahrenheit",
      condition: "sunny",
      city: "San Francisco",
    },
  },
};

export const NestedObject: Story = {
  args: {
    data: {
      location: {
        city: "San Francisco",
        coords: { lat: 37.77, lon: -122.42 },
      },
      readings: [
        { hour: 9, temp: 58 },
        { hour: 12, temp: 65 },
        { hour: 17, temp: 62 },
      ],
      alerts: [],
    },
  },
};

export const DeeplyExpanded: Story = {
  args: {
    data: {
      location: {
        city: "San Francisco",
        coords: { lat: 37.77, lon: -122.42 },
      },
    },
    initialExpandDepth: 3,
  },
};

export const LongString: Story = {
  args: {
    data: {
      note: "x".repeat(160),
    },
  },
};

export const WithHttpUrls: Story = {
  args: {
    data: {
      homepage: "https://example.com",
      docs: "https://modelcontextprotocol.io/docs",
      local: "http://localhost:6274/health",
      longUrl: `https://example.com/resources/${"item-".repeat(30)}`,
    },
  },
};
