import { readFileSync } from "node:fs";
import type { Project, ProjectsFile } from "../src/types.ts";

export const root = new URL("../", import.meta.url).pathname;
export const template = (): ProjectsFile => JSON.parse(readFileSync(`${root}projects.json`, "utf8")) as ProjectsFile;

export const good = (over: Partial<Project> = {}): Project => ({
  id: "my-project",
  name: "My Project",
  lane: "tooling",
  team: ["@some-handle"],
  summary: "A command-line tool that does one useful thing and says so.",
  repo: "https://github.com/some-handle/my-project",
  tests: { command: "npm test", passing: 3, total: 3 },
  devnetSignature: "2eGnTvKicstuqrVfVpDmmM9HExLGw4yMUEbLaHFCvGaxiVkdiGmrtPjXEfuSBTeb8K4wHyXmoweV39hKkWkrTXY6",
  limitation: "Only handles one input format so far.",
  ...over,
});
