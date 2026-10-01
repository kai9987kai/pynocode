#!/usr/bin/env node
/*
 * End-to-end UI checks: drives main.html with real mouse and keyboard input in
 * headless Chromium and asserts on the resulting project state.
 *
 * Usage: node tests/ui_checks.js [screenshotDir]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
const results = [];

function check(name, pass, detail) {
  results.push({ name: name, pass: Boolean(pass), detail: detail === undefined ? "" : String(detail) });
}

async function getState(page) {
  return page.evaluate(function() { return PyNoCode.getState(); });
}

async function widgetBox(page, id) {
  return page.locator('.canvas-widget[data-id="' + id + '"]').first().boundingBox();
}

async function shot(page, name) {
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, name + ".png") });
  }
}

(async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", function(error) { pageErrors.push(error.message); });
  page.on("console", function(message) {
    if (message.type() === "error") {
      pageErrors.push(message.text());
    }
  });
  const url = "file://" + path.join(ROOT, "main.html");
  await page.goto(url);
  await page.evaluate(function() { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(function() { return window.PyNoCode; });

  // Start from a known window size at 100% zoom so pixel maths is simple.
  await page.evaluate(function() {
    PyNoCode.setState({ window: { title: "UI test", width: 700, height: 460 }, settings: { canvasZoomMode: "manual", canvasZoom: 1, gridSize: 10 } });
  });

  // 1. Drag a Button from the palette onto the canvas.
  const surface = page.locator("#canvasSurface");
  await page.locator('.tool-button[data-widget-type="button"]').dragTo(surface, { targetPosition: { x: 200, y: 100 } });
  let s = await getState(page);
  const button = s.widgets[0];
  check("palette drag-and-drop adds a widget", s.widgets.length === 1 && button.type === "button", JSON.stringify(s.widgets));
  check("dropped widget is centred on the pointer and snapped", button && button.x === 130 && button.y === 80, button && [button.x, button.y]);

  // 2. Click-to-add places the next widget under the selection.
  await page.locator('.tool-button[data-widget-type="entry"]').click();
  s = await getState(page);
  const entry = s.widgets[1];
  check("click-to-add stacks below the selected widget", entry && entry.x === button.x && entry.y === button.y + button.height + 10, entry && [entry.x, entry.y]);

  // 3. Drag the entry so its left edge lands 3px from the button's: smart guides snap it.
  let box = await widgetBox(page, entry.id);
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 60, { steps: 5 });
  await page.mouse.move(box.x + 23, box.y + 70, { steps: 5 });
  check("smart guide line is drawn while dragging", await page.locator(".guide-line").count() > 0);
  await page.mouse.up();
  s = await getState(page);
  let movedEntry = s.widgets.find(function(w) { return w.id === entry.id; });
  check("smart guides snap to another widget's edge", movedEntry.x === button.x, movedEntry.x + " vs " + button.x);

  // 4. Alt-drag disables snapping.
  box = await widgetBox(page, entry.id);
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 27, box.y + 13, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  s = await getState(page);
  movedEntry = s.widgets.find(function(w) { return w.id === entry.id; });
  check("Alt-drag moves without snapping", movedEntry.x === button.x + 7, movedEntry.x);

  // 5. Resize with the south-east handle (snaps to the 10px grid).
  await page.locator('.canvas-widget[data-id="' + entry.id + '"] .resize-handle[data-dir="se"]').hover();
  const handle = await page.locator('.canvas-widget[data-id="' + entry.id + '"] .resize-handle[data-dir="se"]').boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y + 30, { steps: 6 });
  await page.mouse.up();
  s = await getState(page);
  const resized = s.widgets.find(function(w) { return w.id === entry.id; });
  check("resize handle changes the size", resized.width > entry.width && resized.height > entry.height, resized.width + "x" + resized.height);
  check("resize snaps the far edge to the grid", (resized.x + resized.width) % 10 === 0 && (resized.y + resized.height) % 10 === 0, [resized.x + resized.width, resized.y + resized.height]);

  // 6. Marquee-select both widgets and align their left edges.
  const surfaceBox = await surface.boundingBox();
  await page.mouse.move(surfaceBox.x + 10, surfaceBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(surfaceBox.x + 600, surfaceBox.y + 300, { steps: 8 });
  await page.mouse.up();
  s = await getState(page);
  check("marquee selects every widget inside it", s.selectedIds.length === 2, s.selectedIds);
  await page.locator('[data-align="left"]').click();
  s = await getState(page);
  check("align left lines up the selection", s.widgets[0].x === s.widgets[1].x, s.widgets.map(function(w) { return w.x; }));

  // 7. Clipboard and history.
  await surface.focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  s = await getState(page);
  check("copy and paste duplicates the selection", s.widgets.length === 4 && s.selectedIds.length === 2, s.widgets.length);
  const names = s.widgets.map(function(w) { return w.name; });
  check("pasted widgets get unique names", new Set(names).size === names.length, names);
  await page.keyboard.press("Delete");
  s = await getState(page);
  check("Delete removes the selection", s.widgets.length === 2, s.widgets.length);
  await page.keyboard.press("Control+z");
  s = await getState(page);
  check("Ctrl+Z restores deleted widgets", s.widgets.length === 4, s.widgets.length);
  await page.keyboard.press("Control+Shift+z");
  s = await getState(page);
  check("Ctrl+Shift+Z redoes", s.widgets.length === 2, s.widgets.length);

  // 8. Context menu: group into a frame.
  await page.evaluate(function() { PyNoCode.setState(Object.assign(PyNoCode.getState(), { selectedIds: PyNoCode.getState().widgets.map(function(w) { return w.id; }) })); });
  box = await widgetBox(page, button.id);
  await page.mouse.click(box.x + 10, box.y + 10, { button: "right" });
  check("right-click opens the context menu", await page.locator("#contextMenu").isVisible());
  await shot(page, "context-menu");
  await page.locator("#contextMenu button", { hasText: "Group into frame" }).click();
  s = await getState(page);
  const frame = s.widgets.find(function(w) { return w.type === "frame"; });
  check("group into frame nests the selection", frame && s.widgets.filter(function(w) { return w.parentId === frame.id; }).length === 2);
  const buttonAfter = s.widgets.find(function(w) { return w.id === button.id; });
  const frameAbs = [frame.x + 10 + buttonAfter.x, frame.y + 10 + buttonAfter.y];
  check("grouping keeps widgets where they were on screen", frameAbs[0] === button.x && frameAbs[1] === button.y, frameAbs);

  // 9. Command palette.
  await page.keyboard.press("Control+k");
  check("Ctrl+K opens the command palette", await page.locator("#commandModal").isVisible());
  await page.keyboard.type("customtkinter");
  await shot(page, "command-palette");
  await page.keyboard.press("Enter");
  s = await getState(page);
  check("palette command switches the export toolkit", s.settings.toolkit === "ctk", s.settings.toolkit);
  await page.waitForTimeout(120);
  check("code view shows CustomTkinter output", (await page.locator("#codeOutput").innerText()).indexOf("import customtkinter as ctk") !== -1);

  // 10. Inspector edits flow into canvas and code.
  await page.evaluate(function(id) { var st = PyNoCode.getState(); st.selectedIds = [id]; PyNoCode.setState(st); }, button.id);
  await page.locator("#tab-props").click();
  await page.locator("#widgetText").fill("Launch rocket");
  await page.waitForTimeout(120);
  check("inspector text edits update the canvas", (await page.locator('.canvas-widget[data-id="' + button.id + '"]').innerText()).indexOf("Launch rocket") !== -1);
  check("inspector text edits update the code", (await page.locator("#codeOutput").innerText()).indexOf("Launch rocket") !== -1);
  await page.locator("#widgetCommand").fill("launch");
  await page.waitForTimeout(120);
  check("commands generate handler stubs", /def launch\(self, event=None\)/.test(await page.locator("#codeOutput").innerText()));

  // 11. Double-click focuses the text field.
  box = await widgetBox(page, button.id);
  await page.mouse.dblclick(box.x + 10, box.y + 10);
  check("double-click focuses the text field", await page.evaluate(function() { return document.activeElement && document.activeElement.id === "widgetText"; }));

  // 12. Quick Form.
  await page.locator("#quickFormBtn").click();
  check("Quick Form opens with a sample", (await page.locator("#quickFormInput").inputValue()).indexOf("# Create account") === 0);
  await page.locator('#quickFormLabelSeg button[data-value="left"]').click();
  await shot(page, "quick-form");
  await page.locator("#quickFormGenerateBtn").click();
  s = await getState(page);
  check("Quick Form builds a full form", s.widgets.length > 15 && s.window.title === "Create account", s.widgets.length);
  let audit = await page.evaluate(function() { return PyNoCode.audit(); });
  check("Quick Form output has no audit errors or warnings", audit.errors === 0 && audit.warnings === 0, JSON.stringify(audit.issues));
  await shot(page, "quick-form-result");

  // 13. Test mode: real controls and live get_values().
  await page.locator("#testMode").check();
  const firstEntry = s.widgets.find(function(w) { return w.type === "entry"; });
  await page.locator('[data-test-id="' + firstEntry.id + '"]').fill("Grace Hopper");
  const values = await page.locator("#testValues").innerText();
  check("test mode shows live get_values()", values.indexOf("Grace Hopper") !== -1, values.slice(0, 200));
  await shot(page, "test-mode");
  await page.locator("#testMode").uncheck();

  // 14. Tab-order overlay and reading order.
  await page.locator("#showTabOrder").check();
  const focusables = s.widgets.filter(function(w) { return ["button", "entry", "text", "combobox", "spinbox", "checkbutton", "radiobutton", "switch", "scale", "listbox", "treeview"].indexOf(w.type) !== -1 && !w.disabled; }).length;
  check("tab-order overlay numbers every focusable widget", await page.locator(".tab-badge").count() === focusables, focusables);
  await page.locator("#showTabOrder").uncheck();

  // 15. Templates.
  await page.locator("#templatesBtn").click();
  check("template gallery shows every template", await page.locator(".template-card").count() === 8);
  await shot(page, "templates");
  await page.locator(".template-card", { hasText: "Dashboard" }).click();
  s = await getState(page);
  check("loading a template replaces the design", s.window.title === "Sales dashboard", s.window.title);

  // 16. Audit: introduce problems and fix them all.
  await page.evaluate(function() {
    var st = PyNoCode.getState();
    st.widgets.push({ id: "bad1", type: "label", name: "faint", text: "Faint text", x: 300, y: 560, width: 120, height: 24, fg: "#3a4a5a", bg: "#0f172a" });
    st.widgets.push({ id: "bad2", type: "button", name: "tiny_button", text: "x", x: 440, y: 560, width: 18, height: 18, fg: "#ffffff", bg: "#0f766e", commandName: "go" });
    PyNoCode.setState(st);
  });
  await page.locator("#tab-audit").click();
  await page.waitForTimeout(150);
  audit = await page.evaluate(function() { return PyNoCode.audit(); });
  check("audit reports contrast and target-size errors", audit.errors >= 2, JSON.stringify(audit.issues.slice(0, 4)));
  await shot(page, "audit");
  await page.locator("#fixAllBtn").click();
  audit = await page.evaluate(function() { return PyNoCode.audit(); });
  check("Fix all clears every error", audit.errors === 0, JSON.stringify(audit.issues.filter(function(i) { return i.severity === "error"; })));

  // 17. Vision simulation and builder dark mode.
  await page.selectOption("#previewFilter", "deuteranopia");
  check("vision simulation applies an SVG filter", (await surface.evaluate(function(el) { return el.style.filter; })).indexOf("cvd-deuteranopia") !== -1);
  await page.selectOption("#previewFilter", "none");
  await page.locator("#uiThemeBtn").click();
  const theme = await page.evaluate(function() { return document.documentElement.getAttribute("data-theme"); });
  check("builder dark/light toggle works", theme === "dark" || theme === "light", theme);
  await page.evaluate(function() { document.documentElement.setAttribute("data-theme", "dark"); });
  await page.locator("#tab-props").click();
  await shot(page, "dark-mode");

  // 18. Download .py and reopen it (embedded project round-trip).
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#downloadCodeBtn").click()]);
  const pyPath = await download.path();
  const pySource = fs.readFileSync(pyPath, "utf8");
  check("download produces a .py named after the window", download.suggestedFilename() === "sales_dashboard.py", download.suggestedFilename());
  const before = await getState(page);
  await page.evaluate(function() { PyNoCode.setState({}); });
  await page.locator("#projectFileInput").setInputFiles({ name: "sales_dashboard.py", mimeType: "text/x-python", buffer: Buffer.from(pySource) });
  await page.waitForTimeout(300);
  const after = await getState(page);
  check("opening an exported .py restores the design", JSON.stringify(after.widgets) === JSON.stringify(before.widgets), after.widgets.length + " vs " + before.widgets.length);

  // 19. Zoom controls.
  const zoomBefore = await page.locator("#zoomLabel").innerText();
  await page.locator("#zoomInBtn").click();
  const zoomAfter = await page.locator("#zoomLabel").innerText();
  check("zoom in changes the zoom level", zoomBefore !== zoomAfter, zoomBefore + " -> " + zoomAfter);

  // 20. Autosave survives a reload.
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(function() { return window.PyNoCode; });
  s = await getState(page);
  check("autosave restores the project after reload", s.window.title === "Sales dashboard" && s.widgets.length === after.widgets.length, s.window.title);

  // 21. Keyboard shortcuts dialog and Escape.
  await page.locator("#canvasSurface").focus();
  await page.keyboard.press("Shift+/");
  check("? opens the shortcuts dialog", await page.locator("#shortcutsModal").isVisible());
  await page.keyboard.press("Escape");
  check("Escape closes dialogs", !(await page.locator("#shortcutsModal").isVisible()));

  await browser.close();

  const failed = results.filter(function(r) { return !r.pass; });
  results.forEach(function(r) {
    console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass || !r.detail ? "" : "\n     " + r.detail.slice(0, 800)));
  });
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " UI checks passed.");
  if (pageErrors.length) {
    console.log("Page errors:\n" + pageErrors.join("\n"));
  }
  process.exit(failed.length || pageErrors.length ? 1 : 0);
})().catch(function(error) {
  console.error(error);
  process.exit(1);
});
