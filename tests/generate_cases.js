#!/usr/bin/env node
/*
 * Drives main.html in headless Chromium and:
 *   1. runs in-browser unit checks (colour science, grid inference, Quick Form,
 *      audit, round-trip import, v2 migration), and
 *   2. writes one Python file per design x toolkit x layout x structure into
 *      the output directory, with a JSON sidecar describing the expected widget
 *      geometry. tests/run_generated.py then executes them with real Tk.
 *
 * Usage: node tests/generate_cases.js [outDir]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, ".out"));

const KITCHEN_SINK = {
  window: {
    title: 'Kitchen "sink" \\ test',
    width: 900,
    height: 640,
    bg: "#f8fafc",
    accent: "#0f766e",
    iconFile: "missing_icon.png",
    minWidth: 400,
    minHeight: 300,
    menu: "File: New, Open..., -, Exit\nEdit: Undo => on_undo, Redo\nHelp: About"
  },
  pythonHooks: "counter = 0\n\n\ndef on_undo(event=None):\n    global counter\n    counter += 1\n    print(\"undo\", counter)\n",
  widgets: [
    { id: "w1", type: "label", name: "title", text: "All widgets — “quotes” and \\backslashes\\", x: 20, y: 10, width: 400, height: 30, fontSize: 18, bold: true },
    { id: "w2", type: "button", name: "class", text: "Keyword name", x: 20, y: 50, width: 140, height: 36, commandName: "on_click", tooltip: "Has a tooltip" },
    { id: "w3", type: "button", name: "disabled_button", text: "Disabled", x: 170, y: 50, width: 120, height: 36, disabled: true, commandName: "on_click", anchor: "w" },
    { id: "w4", type: "entry", name: "2nd field", text: "hello", x: 20, y: 100, width: 200, height: 30, bindings: "<Return> = on_enter\n<FocusOut>: on_leave" },
    { id: "w5", type: "entry", name: "secret", text: "pw", masked: true, x: 230, y: 100, width: 150, height: 30, disabled: true },
    { id: "w6", type: "text", name: "notes", text: "Line 1\nLine 2", x: 20, y: 140, width: 260, height: 90, scrollbar: true },
    { id: "w7", type: "text", name: "plain_text", text: "", x: 290, y: 140, width: 180, height: 90, italic: true, fontFamily: "Courier New" },
    { id: "w8", type: "combobox", name: "choice_box", text: "B", options: ["A", "B", "C"], x: 20, y: 240, width: 160, height: 30 },
    { id: "w9", type: "spinbox", name: "count", min: 0, max: 50, value: 7, x: 190, y: 240, width: 100, height: 30 },
    { id: "w10", type: "checkbutton", name: "agree", text: "I agree", checked: true, x: 20, y: 280, width: 140, height: 28 },
    { id: "w11", type: "switch", name: "wifi", text: "Wi-Fi", x: 170, y: 280, width: 140, height: 28 },
    { id: "w12", type: "radiobutton", name: "size_s", text: "Small", group: "size", x: 20, y: 316, width: 100, height: 28 },
    { id: "w13", type: "radiobutton", name: "size_l", text: "Large", group: "size", checked: true, x: 130, y: 316, width: 100, height: 28 },
    { id: "w14", type: "scale", name: "volume", min: 0, max: 10, value: 3, x: 20, y: 352, width: 220, height: 40 },
    { id: "w15", type: "scale", name: "vertical_scale", orient: "vertical", min: 0, max: 1.5, value: 0.5, x: 480, y: 20, width: 40, height: 200 },
    { id: "w16", type: "progressbar", name: "progress", value: 30, x: 20, y: 402, width: 220, height: 16 },
    { id: "w17", type: "progressbar", name: "vertical_progress", orient: "vertical", value: 60, x: 530, y: 20, width: 16, height: 200 },
    { id: "w18", type: "listbox", name: "fruits", options: ["Apple", "Banana"], x: 250, y: 280, width: 200, height: 120, scrollbar: true },
    { id: "w19", type: "listbox", name: "plain_list", options: [], x: 470, y: 240, width: 120, height: 100 },
    { id: "w20", type: "treeview", name: "people", options: ["Name", "Age", "Name"], text: "Ada, 36, x\nAlan, 41", x: 20, y: 430, width: 360, height: 150, scrollbar: true },
    { id: "w21", type: "canvas", name: "drawing", x: 390, y: 430, width: 160, height: 150 },
    { id: "w22", type: "separator", name: "rule", x: 20, y: 590, width: 360, height: 8 },
    { id: "w23", type: "separator", name: "vertical_rule", orient: "vertical", x: 560, y: 20, width: 8, height: 200 },
    { id: "w24", type: "labelframe", name: "group_box", text: "Group", x: 600, y: 20, width: 280, height: 300 },
    { id: "w25", type: "label", name: "inner_label", parentId: "w24", text: "Inside", x: 10, y: 10, width: 100, height: 26 },
    { id: "w26", type: "entry", name: "inner_entry", parentId: "w24", x: 110, y: 10, width: 140, height: 28 },
    { id: "w27", type: "frame", name: "nested_frame", parentId: "w24", x: 10, y: 60, width: 240, height: 150 },
    { id: "w28", type: "button", name: "deep_button", parentId: "w27", text: "Deep", x: 10, y: 10, width: 100, height: 32, commandName: "on_undo" },
    { id: "w29", type: "checkbutton", name: "deep_check", parentId: "w27", text: "Deep check", x: 10, y: 60, width: 150, height: 28 },
    { id: "w30", type: "label", name: "title", text: "Duplicate name", x: 600, y: 340, width: 200, height: 28 },
    { id: "w31", type: "frame", name: "empty_frame", x: 600, y: 380, width: 280, height: 120 },
    { id: "w32", type: "combobox", name: "disabled_combo", options: ["X"], text: "X", disabled: true, x: 600, y: 520, width: 150, height: 30 }
  ]
};

const LEGACY_V2_PROJECT = {
  nextId: 3,
  selectedId: "widget_2",
  settings: { showGrid: true, snapToGrid: true, gridSize: 20, canvasZoomMode: "fit", canvasZoom: 0.8, exportMode: "script", activeTheme: "clean" },
  window: { title: "Legacy", width: 600, height: 400, bg: "#f4f7fb", iconFile: "", resizableX: false, resizableY: false, topmost: false, fullscreen: false },
  pythonHooks: "def submit_form():\n    print(\"Submit clicked\")",
  widgets: [
    { id: "widget_1", type: "labelframe", name: "panel", x: 40, y: 30, width: 300, height: 200, fg: "#0f172a", bg: "#ffffff", fontSize: 14, text: "Panel" },
    { id: "widget_2", type: "button", name: "submit_button", parentId: "widget_1", x: 20, y: 20, width: 150, height: 40, fg: "#ffffff", bg: "#0f766e", fontSize: 14, text: "Go", commandName: "submit_form" }
  ]
};

function unitChecks(args) {
  /* Runs inside the page. */
  const kitchenSink = args.sink;
  const legacy = args.legacy;
  const results = [];
  function check(name, pass, detail) {
    results.push({ name: name, pass: Boolean(pass), detail: detail === undefined ? "" : String(detail) });
  }
  function near(a, b, tol) {
    return Math.abs(a - b) <= tol;
  }
  const C = PyNoCode.color;

  check("WCAG contrast black/white is 21:1", near(C.contrastRatio("#000000", "#ffffff"), 21, 0.01));
  check("WCAG contrast #777 on white is ~4.48:1", near(C.contrastRatio("#777777", "#ffffff"), 4.48, 0.01), C.contrastRatio("#777777", "#ffffff"));
  check("APCA black on white is Lc ~106.0", near(C.apcaContrast("#000000", "#ffffff"), 106.04, 0.1), C.apcaContrast("#000000", "#ffffff"));
  check("APCA white on black is Lc ~-107.9", near(C.apcaContrast("#ffffff", "#000000"), -107.88, 0.1), C.apcaContrast("#ffffff", "#000000"));
  check("APCA #888 on white is Lc ~63", near(C.apcaContrast("#888888", "#ffffff"), 63.06, 0.3), C.apcaContrast("#888888", "#ffffff"));
  ["#94a3b8", "#fde047", "#0ea5e9", "#f43f5e"].forEach(function(fg) {
    const fixed = C.fixContrast(fg, "#ffffff", 4.5);
    check("fixContrast(" + fg + ") reaches 4.5:1", C.contrastRatio(fixed, "#ffffff") >= 4.5, fixed);
  });
  ["#6d28d9", "#fde047", "#0f766e", "#ef4444", "#94a3b8", "#000000", "#ffffff"].forEach(function(seed) {
    ["light", "dark"].forEach(function(mode) {
      const theme = C.generateTheme(seed, mode);
      const textOk = ["windowBg", "surface", "frameBg"].every(function(key) {
        return C.contrastRatio(theme.text, theme[key]) >= 7;
      });
      check("generated " + mode + " theme from " + seed + " has AAA text", textOk, JSON.stringify(theme));
      check("generated " + mode + " theme from " + seed + " has AA button text", C.contrastRatio(theme.accentText, theme.accent) >= 4.5, theme.accent + "/" + theme.accentText);
    });
  });

  const grid = PyNoCode.inferGrid([
    { id: "a", type: "label", x: 20, y: 20, width: 100, height: 30, orient: "horizontal" },
    { id: "b", type: "entry", x: 130, y: 22, width: 200, height: 30, orient: "horizontal" },
    { id: "c", type: "label", x: 21, y: 70, width: 100, height: 30, orient: "horizontal" },
    { id: "d", type: "entry", x: 130, y: 70, width: 200, height: 30, orient: "horizontal" },
    { id: "e", type: "text", x: 20, y: 120, width: 310, height: 80, orient: "horizontal" }
  ], 6);
  check("grid inference finds 2 columns and 3 rows", grid.columns.length === 2 && grid.rows.length === 3, grid.columns.length + "x" + grid.rows.length);
  const spanning = grid.cells.find(function(cell) { return cell.widget.id === "e"; });
  check("grid inference detects a column span", spanning && spanning.col === 0 && spanning.colEnd === 1, JSON.stringify(spanning && [spanning.col, spanning.colEnd]));
  check("grid inference weights the entry column", grid.columns[1].weight === 1 && grid.rows[2].weight === 1);

  const form = PyNoCode.quickForm("# Hello\nName*\nEmail: email = a@b.c\nPlan: radio(A, B) = B\nNotes: multiline\nOK: check = yes\n[Save] [Cancel]", { labels: "left" });
  const byName = {};
  form.widgets.forEach(function(w) { byName[w.name] = w; });
  check("quick form sets the window title", form.window.title === "Hello");
  check("quick form creates labelled entries", byName.name_entry && byName.name_label && byName.email_entry && byName.email_entry.text === "a@b.c", Object.keys(byName).join(","));
  check("quick form radio default", byName.plan_b_radio && byName.plan_b_radio.checked && !byName.plan_a_radio.checked);
  check("quick form check default", byName.ok_check && byName.ok_check.checked);
  check("quick form buttons get handlers", byName.save_button && byName.save_button.commandName === "on_save");
  const formAudit = PyNoCode.audit(form);
  check("quick form output passes the audit with no errors or warnings", formAudit.errors === 0 && formAudit.warnings === 0, JSON.stringify(formAudit.issues.filter(function(i) { return i.severity !== "info"; })));
  const topForm = PyNoCode.quickForm("Name\nEmail: email\nBio: multiline\n[Go]", { labels: "top" });
  const topAudit = PyNoCode.audit(topForm);
  check("top-label quick form passes the audit", topAudit.errors === 0 && topAudit.warnings === 0, JSON.stringify(topAudit.issues));

  PyNoCode.templates().forEach(function(template) {
    const design = PyNoCode.buildTemplate(template.id);
    const audit = PyNoCode.audit(design);
    check("template " + template.id + " has no audit errors", audit.errors === 0, JSON.stringify(audit.issues.filter(function(i) { return i.severity === "error"; })));
    check("template " + template.id + " has no audit warnings", audit.warnings === 0, JSON.stringify(audit.issues.filter(function(i) { return i.severity === "warning"; })));
  });

  const sinkAudit = PyNoCode.audit(kitchenSink);
  const rules = sinkAudit.issues.map(function(i) { return i.rule + " :: " + i.message; }).join("\n");
  check("audit flags the Python keyword name", /"class" is not a valid Python name/.test(rules), rules);
  check("audit flags duplicate names", /Two widgets are named "title"/.test(rules), rules);
  check("audit flags unlabelled inputs", /3\.3\.2/.test(rules), rules);

  const low = PyNoCode.normalize({ widgets: [{ id: "x", type: "label", name: "faint", text: "Faint", fg: "#cccccc", bg: "#ffffff" }, { id: "y", type: "button", name: "tiny", text: "t", width: 16, height: 16, commandName: "go" }] });
  const lowAudit = PyNoCode.audit(low);
  check("audit flags low contrast", lowAudit.issues.some(function(i) { return /1\.4\.3/.test(i.rule); }));
  check("audit flags small targets", lowAudit.issues.some(function(i) { return /2\.5\.8/.test(i.rule); }));

  const embedded = PyNoCode.generateFor(kitchenSink, { embedProject: true });
  const roundTrip = PyNoCode.normalize(PyNoCode.importPython(embedded));
  const original = PyNoCode.normalize(kitchenSink);
  check("exported .py round-trips back to the same design",
    JSON.stringify(roundTrip.widgets) === JSON.stringify(original.widgets) && JSON.stringify(roundTrip.window) === JSON.stringify(original.window));

  const migrated = PyNoCode.normalize(legacy);
  check("v2 projects migrate (toolkit tk, script export)", migrated.settings.toolkit === "tk" && migrated.settings.exportMode === "script" && migrated.widgets.length === 2);
  check("v2 selection migrates", migrated.selectedIds.length === 1 && migrated.selectedIds[0] === "widget_2");

  const names = PyNoCode.referenceNames(kitchenSink);
  check("keyword widget names are made safe", names.w2 === "class_", names.w2);
  check("invalid widget names are sanitised", names.w4 === "_2nd_field", names.w4);
  check("duplicate widget names get suffixes", names.w1 === "title" && names.w30 === "title_2", names.w1 + "," + names.w30);
  return results;
}

const SLIDER_THICKNESS = { ttk: 22, ctk: 18 };

function expectedGeometry(design, names, toolkit) {
  /* Absolute outer rectangles relative to each parent's outer box, keyed by Python name. */
  const byId = {};
  design.widgets.forEach(function(w) { byId[w.id] = w; });
  const expect = {};
  design.widgets.forEach(function(w) {
    if (w.scrollbar && ["text", "listbox", "treeview"].indexOf(w.type) !== -1) {
      return;
    }
    const parent = w.parentId ? byId[w.parentId] : null;
    const inset = !parent ? { left: 0, top: 0 } : parent.type === "labelframe" ? { left: 10, top: 24 } : { left: 10, top: 10 };
    let x = inset.left + w.x;
    let y = inset.top + w.y;
    let width = w.width;
    let height = w.height;
    if (w.type === "scale" && SLIDER_THICKNESS[toolkit]) {
      if (w.orient === "vertical") {
        const thin = Math.min(width, SLIDER_THICKNESS[toolkit]);
        x += Math.floor((width - thin) / 2);
        width = thin;
      } else {
        const thin = Math.min(height, SLIDER_THICKNESS[toolkit]);
        y += Math.floor((height - thin) / 2);
        height = thin;
      }
    }
    if (w.type === "separator") {
      if (w.orient === "vertical") {
        x += Math.floor(width / 2) - 1;
        width = 2;
      } else {
        y += Math.floor(height / 2) - 1;
        height = 2;
      }
    }
    expect[names[w.id]] = [x, y, width, height];
  });
  return expect;
}

(async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", function(error) { pageErrors.push(error.message); });
  page.on("console", function(message) {
    if (message.type() === "error") {
      pageErrors.push(message.text());
    }
  });
  await page.goto("file://" + path.join(ROOT, "main.html"));
  await page.waitForFunction(function() { return window.PyNoCode; });

  const units = await page.evaluate(unitChecks, { sink: KITCHEN_SINK, legacy: LEGACY_V2_PROJECT }).catch(function(error) {
    return [{ name: "unit checks crashed", pass: false, detail: error.message }];
  });

  const designs = await page.evaluate(function(args) {
    const result = {};
    PyNoCode.templates().forEach(function(t) {
      result[t.id] = PyNoCode.buildTemplate(t.id);
    });
    result.kitchen_sink = PyNoCode.normalize(args.sink);
    result.legacy_v2 = PyNoCode.normalize(args.legacy);
    result.empty = PyNoCode.normalize({});
    return result;
  }, { sink: KITCHEN_SINK, legacy: LEGACY_V2_PROJECT });

  let count = 0;
  for (const designId of Object.keys(designs)) {
    const design = designs[designId];
    const names = await page.evaluate(function(raw) { return PyNoCode.referenceNames(raw); }, design);
    for (const toolkit of ["tk", "ttk", "ctk"]) {
      const expect = expectedGeometry(design, names, toolkit);
      for (const layout of ["place", "relative", "grid"]) {
        for (const structure of ["class", "script"]) {
          const code = await page.evaluate(function(args) {
            return PyNoCode.generateFor(args.design, { toolkit: args.toolkit, layout: args.layout, structure: args.structure, embedProject: true, getValues: true, dpiAware: true, pixelFonts: true });
          }, { design: design, toolkit: toolkit, layout: layout, structure: structure });
          const base = [designId, toolkit, layout, structure].join("__");
          fs.writeFileSync(path.join(OUT, base + ".py"), code);
          fs.writeFileSync(path.join(OUT, base + ".json"), JSON.stringify({
            design: designId, toolkit: toolkit, layout: layout, structure: structure,
            expect: layout === "grid" ? {} : expect,
            window: [design.window.width, design.window.height]
          }, null, 1));
          count += 1;
        }
      }
    }
  }
  await browser.close();

  const failed = units.filter(function(u) { return !u.pass; });
  units.forEach(function(u) {
    console.log((u.pass ? "PASS " : "FAIL ") + u.name + (u.pass || !u.detail ? "" : "\n     " + u.detail.slice(0, 1200)));
  });
  console.log("\n" + (units.length - failed.length) + "/" + units.length + " browser unit checks passed; wrote " + count + " Python cases to " + OUT);
  if (pageErrors.length) {
    console.log("Page errors:\n" + pageErrors.join("\n"));
  }
  process.exit(failed.length || pageErrors.length ? 1 : 0);
})().catch(function(error) {
  console.error(error);
  process.exit(1);
});
