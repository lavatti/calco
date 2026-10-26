#!/usr/bin/env node
/** Check a clone's route inventory and named browser journeys against a local preview. */
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const configPath = process.argv[2];
if (!configPath || process.argv.length !== 3) {
  console.error("Usage: npm run clone:smoke -- <config.json>");
  process.exit(2);
}

const absoluteConfig = resolve(configPath);
const configDir = dirname(absoluteConfig);
const config = JSON.parse(await readFile(absoluteConfig, "utf8"));
if (!config.baseUrl || !Array.isArray(config.journeys) || !config.routesFile) {
  throw new Error("Config needs baseUrl, routesFile, and journeys[]");
}
if (!config.journeys.some((journey) => (journey.viewport?.width ?? 1440) >= 1024) ||
    !config.journeys.some((journey) => (journey.viewport?.width ?? 1440) <= 600)) {
  throw new Error("Config needs at least one desktop and one mobile browser journey");
}
const baseUrl = new URL(config.baseUrl);
if (!["http:", "https:"].includes(baseUrl.protocol)) throw new Error("HTTP(S) baseUrl required");
const inventory = JSON.parse(await readFile(resolve(configDir, config.routesFile), "utf8"));
const routes = [...new Set(inventory.pages.filter((page) => page.status === 200).map((page) => page.path))];
if (routes.length < (config.minRoutes ?? 1)) {
  throw new Error(`Only ${routes.length} captured routes; expected at least ${config.minRoutes}`);
}

const outDir = resolve(configDir, config.outDir ?? "smoke-results");
await mkdir(outDir, { recursive: true });
const report = { baseUrl: baseUrl.href, routeCount: routes.length, routeFailures: [], distinctBodies: 0, journeys: [] };
const hashes = new Set();
let next = 0;
async function checkRoute() {
  while (next < routes.length) {
    const path = routes[next++];
    try {
      const response = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      if (response.status !== 200 || !contentType.includes("text/html") || !/<title[\s>]/i.test(html)) {
        report.routeFailures.push({ path, status: response.status, contentType });
      } else {
        hashes.add(createHash("sha256").update(html).digest("hex"));
      }
    } catch (error) {
      report.routeFailures.push({ path, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(12, routes.length) }, checkRoute));
report.distinctBodies = hashes.size;
if (hashes.size < (config.minDistinctBodies ?? 2)) {
  report.routeFailures.push({ error: `Only ${hashes.size} distinct HTML responses` });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const journey of config.journeys) {
    const entry = { name: journey.name ?? journey.path, passed: false };
    const page = await browser.newPage({ viewport: journey.viewport ?? { width: 1440, height: 900 } });
    try {
      const response = await page.goto(new URL(journey.path, baseUrl).href, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      if (response?.status() !== 200) throw new Error(`Entry returned HTTP ${response?.status()}`);
      for (const selector of journey.visible ?? []) {
        if (!(await page.locator(selector).first().isVisible())) throw new Error(`Not visible: ${selector}`);
      }
      for (const selector of journey.hidden ?? []) {
        if (await page.locator(selector).first().isVisible()) throw new Error(`Still visible: ${selector}`);
      }
      for (const check of journey.css ?? []) {
        const actual = await page.locator(check.selector).first().evaluate(
          (element, property) => getComputedStyle(element).getPropertyValue(property).trim(),
          check.property,
        );
        if (actual !== check.value) throw new Error(`${check.selector} ${check.property}: ${actual}, expected ${check.value}`);
      }
      for (const step of journey.steps ?? []) {
        const locator = page.locator(step.selector).first();
        if (step.type === "hover") await locator.hover();
        else if (step.type === "click") await locator.click();
        else throw new Error(`Unknown journey step: ${step.type}`);
      }
      if (journey.expectPath) {
        await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === journey.expectPath.replace(/\/$/, ""), {
          timeout: 10000,
        });
      }
      if (new URL(page.url()).origin !== baseUrl.origin) {
        throw new Error(`Navigation left the local clone: ${page.url()}`);
      }
      if (journey.expectTitle && !(await page.title()).includes(journey.expectTitle)) {
        throw new Error(`Destination title does not include ${journey.expectTitle}`);
      }
      entry.passed = true;
      entry.finalUrl = page.url();
    } catch (error) {
      entry.error = String(error);
      entry.finalUrl = page.url();
    }
    try {
      await page.screenshot({ path: resolve(outDir, `${report.journeys.length + 1}-${entry.passed ? "pass" : "fail"}.png`) });
    } catch (error) {
      entry.screenshotError = String(error);
    }
    report.journeys.push(entry);
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
const failedJourneys = report.journeys.filter((journey) => !journey.passed);
console.log(`${routes.length} routes: ${report.routeFailures.length} failures; ${hashes.size} distinct bodies`);
console.log(`${report.journeys.length} browser journeys: ${failedJourneys.length} failures`);
console.log(`Report: ${resolve(outDir, "report.json")}`);
if (report.routeFailures.length || failedJourneys.length) process.exitCode = 1;
