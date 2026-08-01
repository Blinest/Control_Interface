import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { mojibakePattern } from "./mojibake-denylist.mjs";

const routes = ["/#/dashboard", "/#/workspace", "/#/charts", "/#/sessions", "/#/logs", "/#/settings"];
const viewports = [
  { width: 1600, height: 980, name: "desktop" },
  { width: 1280, height: 800, name: "min-desktop" },
];
const themes = ["light", "dark"];
const baseUrl = "http://127.0.0.1:1421";
const visualSmokeMarkerPath = "/__softui_visual_smoke_marker__";
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = resolve(rootDirectory, "artifacts", "visual-smoke");
const layoutEditTextPattern = /(?:\u8c03\u6574\u5e03\u5c40|\u7f16\u8f91\u5e03\u5c40|\u4fdd\u5b58\u5e03\u5c40)/u;
const layoutEditCancelLabel = "\u53d6\u6d88";

function normalizeWorktreePath(directory) {
  const normalized = resolve(directory).replaceAll("\\", "/").replace(/\/+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function portIsOpen(port) {
  return new Promise((resolvePort) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (open) => {
      socket.destroy();
      resolvePort(open);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

async function waitForServer(server, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before starting:\n${output()}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server has not started accepting requests yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for Vite on port 1421:\n${output()}`);
}

async function assertSoftuiDevServer() {
  let response;
  try {
    response = await fetch(`${baseUrl}${visualSmokeMarkerPath}`);
  } catch (error) {
    throw new Error(`Port 1421 is occupied by a service that is not this SoftUI worktree (${rootDirectory}): marker request failed (${error.message})`);
  }
  if (!response.ok) {
    throw new Error(`Port 1421 is occupied by a service that is not this SoftUI worktree (${rootDirectory}): marker endpoint returned HTTP ${response.status}`);
  }

  let marker;
  try {
    marker = await response.json();
  } catch {
    throw new Error(`Port 1421 is occupied by a service that is not this SoftUI worktree (${rootDirectory}): marker response is not JSON`);
  }
  if (marker.app !== "softui-desktop" || marker.root !== normalizeWorktreePath(rootDirectory)) {
    throw new Error(`Port 1421 is occupied by a different app or worktree; expected SoftUI at ${rootDirectory}`);
  }
}

async function startViteIfNeeded() {
  if (await portIsOpen(1421)) {
    await assertSoftuiDevServer();
    return null;
  }

  let output = "";
  const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
  const npmArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd run dev -- --host 127.0.0.1"]
    : ["run", "dev", "--", "--host", "127.0.0.1"];
  const server = spawn(npmCommand, npmArgs, {
    cwd: rootDirectory,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const appendOutput = (chunk) => {
    output = `${output}${chunk}`.slice(-8_000);
  };
  server.stdout.on("data", appendOutput);
  server.stderr.on("data", appendOutput);

  try {
    await waitForServer(server, () => output);
    await assertSoftuiDevServer();
    return server;
  } catch (error) {
    await stopVite(server);
    throw error;
  }
}

async function stopVite(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolveStop) => {
      const taskkill = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      taskkill.once("exit", resolveStop);
      taskkill.once("error", resolveStop);
    });
    return;
  }
  server.kill("SIGTERM");
  await new Promise((resolveStop) => server.once("exit", resolveStop));
}

async function expectVisible(page, selector) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 10_000 });
}

async function expectNoText(page, pattern) {
  const visibleText = await page.locator("body").innerText();
  if (pattern.test(visibleText)) throw new Error(`Unexpected visible text matched ${pattern}`);
}

async function expectNoLayoutEditCancelButton(page) {
  const violations = await page.locator('button, [role="button"], input[type="button"], input[type="submit"]').evaluateAll(
    (elements, cancelLabel) => elements
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        const label = (element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("value") || "").trim();
        if (label !== cancelLabel) return false;

        for (let current = element; current && current !== document.body; current = current.parentElement) {
          const metadata = [
            current.className,
            current.id,
            current.getAttribute("aria-label"),
            current.getAttribute("data-testid"),
            current.getAttribute("data-layout"),
          ].filter((value) => typeof value === "string").join(" ");
          if (/(?:layout|edit|\u5e03\u5c40)/iu.test(metadata)) return true;
        }
        return false;
      })
      .map((element) => ({
        className: element.className,
        text: element.textContent?.trim(),
      })),
    layoutEditCancelLabel,
  );
  if (violations.length > 0) throw new Error(`Unexpected layout-edit cancel button: ${JSON.stringify(violations)}`);
}

async function assertNoZeroSizedText(page) {
  const zeroSized = await page.locator("body *").evaluateAll((elements) => elements
    .filter((element) => {
      const text = element.textContent?.trim();
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return Boolean(text)
        && element.tagName !== "OPTION"
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity) !== 0
        && (rect.width === 0 || rect.height === 0);
    })
    .slice(0, 10)
    .map((element) => ({
      element: element.tagName.toLowerCase(),
      className: element.className,
      text: element.textContent?.trim().slice(0, 120),
    })));
  if (zeroSized.length > 0) throw new Error(`Visible text has a zero-sized box: ${JSON.stringify(zeroSized)}`);
}

async function assertBodyFitsViewport(page) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    viewportHeight: window.innerHeight,
  }));
  if (metrics.scrollHeight > metrics.viewportHeight + 2) {
    throw new Error(`Body scroll height ${metrics.scrollHeight}px exceeds viewport ${metrics.viewportHeight}px`);
  }
}

async function assertAppContentHasNoVisibleScrollbar(page) {
  const visibleScrollbar = await page.locator(".app-content").evaluate((element) => {
    const style = getComputedStyle(element);
    const canScroll = ["auto", "scroll"].includes(style.overflowY) && element.scrollHeight > element.clientHeight;
    return canScroll && element.offsetWidth - element.clientWidth > 0;
  });
  if (visibleScrollbar) throw new Error(".app-content has a visible vertical scrollbar");
}

async function assertChartsFillPrimaryRegion(page) {
  const metrics = await page.evaluate(() => {
    const primary = document.querySelector(".chart-layout > .layout-scroll-region");
    const grid = document.querySelector(".charts-subplot-grid");
    const subplots = Array.from(document.querySelectorAll(".chart-subplot"));
    if (!primary || !grid) return null;
    const primaryRect = primary.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const subplotRects = subplots.map((subplot) => subplot.getBoundingClientRect());
    return {
      primaryHeight: primaryRect.height,
      gridHeight: gridRect.height,
      subplotCount: subplots.length,
      minSubplotHeight: Math.min(...subplotRects.map((rect) => rect.height)),
      lowerBlank: Math.max(0, primaryRect.bottom - gridRect.bottom),
    };
  });
  if (!metrics) throw new Error("Charts route did not render the subplot grid");
  if (metrics.subplotCount < 6) throw new Error(`Charts route rendered ${metrics.subplotCount} subplots, expected at least 6`);
  if (metrics.minSubplotHeight < 120) throw new Error(`Charts subplots are clipped to ${metrics.minSubplotHeight}px`);
  if (metrics.lowerBlank > Math.max(24, metrics.primaryHeight * 0.08)) {
    throw new Error(`Charts subplot grid leaves ${metrics.lowerBlank}px blank below the primary region`);
  }
}

function screenshotPath(route, theme, viewport) {
  const routeName = route.replace(/^\/#\//, "").replace(/[^a-z0-9]+/gi, "-");
  return resolve(artifactDirectory, `${routeName}-${theme}-${viewport.name}.png`);
}

async function verifyRoute(browser, route, theme, viewport) {
  const context = await browser.newContext({ colorScheme: theme, viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.stack ?? error.message));
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("softui:theme:anonymous", selectedTheme);
    localStorage.setItem("softui:theme:visual-smoke", selectedTheme);
    localStorage.setItem("softui:currentDeviceId", "softui-sim-01");
    window.__SOFTUI_VISUAL_SMOKE__ = true;
  }, theme);

  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await expectVisible(page, ".app-shell, .login-shell");
    await page.evaluate((selectedTheme) => {
      localStorage.setItem("softui:theme:visual-smoke", selectedTheme);
      document.documentElement.dataset.theme = selectedTheme;
      document.documentElement.style.colorScheme = selectedTheme;
    }, theme);
    await expectVisible(page, ".app-sidebar");
    await expectVisible(page, ".global-status-bar");
    await expectNoText(page, mojibakePattern);
    await expectNoText(page, layoutEditTextPattern);
    await expectNoLayoutEditCancelButton(page);

    if (route === "/#/charts") {
      await expectVisible(page, ".charts-sidebar");
      await expectVisible(page, ".responsive-rail-toggle");
      await expectVisible(page, ".charts-subplot-grid");
      await assertChartsFillPrimaryRegion(page);
    }
    if (route === "/#/workspace") {
      await expectVisible(page, ".monitor-motor-summary-cell");
      await expectVisible(page, ".monitor-motor-status-lamp");
      await expectVisible(page, ".monitor-motor-summary-value");
    }
    if (route === "/#/sessions") {
      await expectVisible(page, ".recorder-workbench");
      await expectVisible(page, ".sessions-page-content");
    }
    if (route === "/#/settings") {
      await expectVisible(page, ".settings-navigation-tabs");
      await expectVisible(page, ".settings-section");
    }

    await page.waitForTimeout(250);
    await assertNoZeroSizedText(page);
    await assertBodyFitsViewport(page);
    await assertAppContentHasNoVisibleScrollbar(page);
    await page.screenshot({ path: screenshotPath(route, theme, viewport), fullPage: false });
    if (consoleErrors.length > 0) throw new Error(`Console errors:\n${consoleErrors.join("\n")}`);
  } finally {
    await context.close();
  }
}

let viteServer;
let browser;
try {
  await mkdir(artifactDirectory, { recursive: true });
  viteServer = await startViteIfNeeded();
  browser = await chromium.launch();
  for (const route of routes) {
    for (const theme of themes) {
      for (const viewport of viewports) {
        await verifyRoute(browser, route, theme, viewport);
      }
    }
  }
  console.log(`PASS visual smoke: ${routes.length * themes.length * viewports.length} screenshots saved to artifacts/visual-smoke`);
} finally {
  await browser?.close();
  await stopVite(viteServer);
}
