#!/usr/bin/env node
/** Install Calco dependencies and the browser used by either supported agent. */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const agentFlag = args.find((arg) => arg.startsWith("--agent="));
const agent = agentFlag?.slice("--agent=".length) ?? "claude";

if (
  args.some((arg) => arg !== "--check" && arg !== agentFlag) ||
  !["codex", "claude"].includes(agent)
) {
  console.error("Usage: npm run setup -- [--agent=codex|claude] [--check]");
  process.exit(2);
}

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const has = (command) =>
  spawnSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" })
    .status === 0;

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`Node ${process.versions.node} found; Calco requires Node 20+.`);
  process.exit(1);
}
if (!has(agent)) {
  console.error(`${agent} CLI not found on PATH.`);
  process.exit(1);
}

console.log(`Calco: Node ${process.versions.node}; ${agent} CLI available.`);
if (!checkOnly) {
  run("npm", ["ci"]);
  run("npx", ["playwright", "install", "chromium"]);
}

if (agent === "codex") {
  console.log("Codex: run npm run codex, then invoke $clone-website with the target URL(s).");
  console.log("Codex uses .agents/skills/clone-website/SKILL.md and .codex/config.toml for MCP.");
  console.log("The npm launcher supplies Playwright even before project trust is stored.");
} else {
  console.log(
    "Claude Code: open this repository and invoke /clone-website with the target URL(s).",
  );
  console.log("Claude Code uses .claude/skills/clone-website/SKILL.md and .mcp.json.");
}
