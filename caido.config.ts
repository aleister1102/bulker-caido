import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "bulker",
  name: "Bulker",
  description: "Bulk HTTP request sender with concurrent execution",
  version: "1.0.4",
  author: {
    name: "insomnia1102",
    url: "https://github.com/aleister1102/bulker-caido",
  },
  plugins: [
    {
      kind: "frontend",
      id: "bulker-frontend",
      name: "Bulker UI",
      root: "./src/frontend",
      backend: {
        id: "bulker-backend",
      },
    },
    {
      kind: "backend",
      id: "bulker-backend",
      name: "Bulker Backend",
      root: "./src/backend",
    },
  ],
});
