#!/usr/bin/env node
/** Start Codex with Calco's browser MCP even before project trust is stored. */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "codex",
  [
    "-c",
    'mcp_servers.playwright.command="npx"',
    "-c",
    'mcp_servers.playwright.args=["-y","@playwright/mcp@latest","--headless"]',
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
