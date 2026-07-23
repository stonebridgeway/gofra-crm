import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
const isUserOrOrganizationPage = repositoryName.endsWith(".github.io");
const githubPagesBase =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName &&
  !isUserOrOrganizationPage
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || githubPagesBase,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
