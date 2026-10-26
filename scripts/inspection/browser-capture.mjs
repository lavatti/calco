#!/usr/bin/env node
/** Headless, agent-neutral capture of rendered pages and selected UI states. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { discoverAssets } from "./discover-assets.js";
import { extractComputedStyles } from "./extract-styles.js";

const [rawUrl, rawOutDir, ...rest] = process.argv.slice(2);
if (!rawUrl || !rawOutDir || rest.length % 2 !== 0) {
  console.error(
    "Usage: node scripts/inspection/browser-capture.mjs <url> <outDir> [--actions <actions.json>] [--selectors <selectors.json>]",
  );
  process.exit(2);
}

const options = {};
for (let i = 0; i < rest.length; i += 2) {
  if (!["--actions", "--selectors"].includes(rest[i]) || options[rest[i]]) {
    throw new Error(`Unknown or repeated option: ${rest[i]}`);
  }
  options[rest[i]] = rest[i + 1];
}

let target;
try {
  target = new URL(rawUrl);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("HTTP(S) URL required");
} catch (error) {
  console.error(`Invalid URL: ${error.message}`);
  process.exit(2);
}

const outDir = resolve(rawOutDir);
let actions = [];
if (options["--actions"]) {
  actions = JSON.parse(await readFile(options["--actions"], "utf8"));
  if (!Array.isArray(actions)) throw new Error("Actions JSON must be an array");
  for (const action of actions) {
    if (!action || !["click", "hover", "scroll"].includes(action.type)) {
      throw new Error("Each action needs type: click, hover, or scroll");
    }
    if (action.type !== "scroll" && typeof action.selector !== "string") {
      throw new Error("Click/hover actions need a CSS selector");
    }
  }
}
let selectors = ["body", "header", "main", "footer"];
if (options["--selectors"]) {
  selectors = JSON.parse(await readFile(options["--selectors"], "utf8"));
  if (!Array.isArray(selectors) || selectors.some((selector) => typeof selector !== "string")) {
    throw new Error("Selectors JSON must be an array of CSS selectors");
  }
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { url: target.href, capturedAt: new Date().toISOString(), viewports: {} };
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    const failedRequests = [];
    const badResponses = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) =>
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" }),
    );
    page.on("response", (response) => {
      if (response.status() >= 400)
        badResponses.push({ url: response.url(), status: response.status() });
    });
    const response = await page.goto(target.href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(outDir, `${viewport.name}.png`), fullPage: true });
    await writeFile(join(outDir, `${viewport.name}.html`), await page.content());
    await writeFile(
      join(outDir, `${viewport.name}-assets.json`),
      `${await page.evaluate(discoverAssets)}\n`,
    );
    const styles = {};
    for (const selector of selectors) {
      styles[selector] = JSON.parse(await page.evaluate(extractComputedStyles, selector));
    }
    await writeFile(
      join(outDir, `${viewport.name}-styles.json`),
      `${JSON.stringify(styles, null, 2)}\n`,
    );

    const states = [];
    for (const [index, action] of actions.entries()) {
      if (action.type === "scroll") {
        await page.evaluate((pixels) => window.scrollBy(0, pixels), Number(action.pixels ?? 0));
      } else if (action.type === "click") {
        await page.locator(action.selector).first().click();
      } else {
        await page.locator(action.selector).first().hover();
      }
      await page.waitForTimeout(250);
      const stateName = `${viewport.name}-state-${index + 1}`;
      await page.screenshot({ path: join(outDir, `${stateName}.png`), fullPage: true });
      states.push({ action, screenshot: `${stateName}.png`, url: page.url() });
    }

    const dom = await page.evaluate(() => ({
      title: document.title,
      lang: document.documentElement.lang || null,
      headings: [...document.querySelectorAll("h1,h2,h3")].map((el) => ({
        level: el.tagName,
        text: el.textContent?.trim() ?? "",
      })),
      links: [...document.querySelectorAll("a[href]")].map((el) => ({
        text: el.textContent?.trim() ?? "",
        href: el.href,
      })),
      media: [...document.querySelectorAll("img,video,source")].map((el) => ({
        tag: el.tagName,
        src: el.currentSrc || el.src || el.getAttribute("srcset") || null,
      })),
    }));
    report.viewports[viewport.name] = {
      width: viewport.width,
      height: viewport.height,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      ...dom,
      errors,
      failedRequests,
      badResponses,
      states,
    };
    await page.close();
    console.log(`${viewport.name}: HTTP ${response?.status() ?? "?"}, ${dom.title}`);
  }
} finally {
  await browser.close();
}

await writeFile(join(outDir, "inspection.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Saved screenshots, rendered DOM, and inspection.json to ${outDir}`);
