# PyNoCode Builder

Design desktop user interfaces visually in your browser, check them against accessibility and layout research, and export clean Python for **Tkinter**, **themed ttk** or **CustomTkinter**.

Everything lives in one self-contained file, `main.html`. There is nothing to install and no server; your work never leaves your browser.

## Quick start

1. Download or clone the repository.
2. Open `main.html` in a modern browser (Chrome, Edge, Firefox or Safari).
3. Start from **Templates** or **Quick Form**, or drag widgets onto the canvas.
4. Pick a toolkit and layout under **Python Export**, then **Download .py** and run it:

```bash
python sign_in.py
# CustomTkinter exports also need:
pip install customtkinter
```

Exported files carry the design with them. Open a `.py` file you exported earlier (**Open**, or drop it on the page) and you can keep editing.

## What you can build

### 17 widgets

| Group | Widgets |
| --- | --- |
| Text and actions | Label, Button |
| Inputs | Entry (with password mask), Text (with scrollbar), Combobox, Spinbox, Checkbutton, Radiobutton (grouped), Switch, Scale (horizontal or vertical), Listbox (with scrollbar) |
| Display | Progressbar, Treeview (columns and rows), Canvas, Separator |
| Containers | Frame, LabelFrame (nestable to any depth) |

Every widget supports colours, font family, size, bold and italic, text alignment, a disabled state, a hover **tooltip**, and **event bindings** (`<Return> = on_submit`). Buttons take a command, and the window can have a **menu bar** (`File: New, Open..., -, Exit`).

### Editing

- Drag widgets from the palette, or click to add one below the current selection.
- **Smart alignment guides** snap to other widgets' edges and centres. The grid is the fallback; hold <kbd>Alt</kbd> to place freely.
- Eight resize handles, with live size read-outs and snapping.
- Multi-select with <kbd>Shift</kbd>-click or a marquee. Then align, distribute, match sizes, stack, or **group into a frame**.
- Cut, copy, paste and duplicate (with descendants), a right-click context menu, layer reordering by drag, and position locks.
- Undo and redo, zoom from 25% to 300%, a mock title and menu bar, and local autosave.
- A **Ctrl+K command palette** for every action, plus full keyboard shortcuts (press <kbd>?</kbd>).
- A light or dark builder UI that follows your system setting.

### Exporting Python

| Option | Choices |
| --- | --- |
| Toolkit | **Tkinter** (classic widgets), **ttk** (themed widgets on the cross-platform `clam` theme, with a generated style per look), **CustomTkinter** (modern rounded widgets, automatic high-DPI scaling) |
| Layout | **Absolute** `place()`, pixel-exact. **Relative** `place(relx=...)`, which scales with the window. **Grid**: rows, columns, spans, padding and resize weights are *inferred* from your design so the window reflows. |
| Structure | An `App` class with methods, or a flat beginner-friendly script |

The generated code:

- is **what you see**: fonts use pixel sizes by default, and children of frames are placed with `bordermode="outside"`, so positions match the canvas to the pixel;
- includes a `get_values()` helper that returns every input's current value as a dict;
- creates handler stubs for every command, binding and menu item you haven't written yourself (write your own in the **Code** tab);
- only imports what it uses and is **pyflakes-clean**;
- escapes every string safely, and renames widgets whose names are Python keywords or duplicates.

### Test mode

Switch on **Test mode** to use the design with real controls. Type, tick, choose and slide, and a live `get_values()` panel shows exactly what your Python code will receive. Buttons report which handler they would call.

### Quick Form

Describe a form in plain text and get a laid-out, labelled, themed UI:

```text
# Create account
Full name*
Email*: email
Password*: password
Country: choice(United Kingdom, United States, Canada) = United Kingdom
Plan: radio(Free, Pro, Team) = Pro
Age: number(13, 120) = 30
About you: multiline
Newsletter: switch = on
[Create account] [Cancel]
```

Supported types: `text`, `email`, `password`, `multiline`, `number(min, max)`, `choice(...)`, `radio(...)`, `check`, `switch`, `slider(min, max)`, `list(...)`, `progress`, `date` and `table(...)`. `## Section` starts a LabelFrame and `---` draws a separator. Labels go on top by default; left-aligned labels are one click away.

### Templates

Sign in, Contact form, Settings, To-do list, Calculator, Dashboard and Survey. Every template passes the design audit with zero errors and zero warnings.

## Research built in

The **Audit** tab reviews your design continuously. It explains each finding, and most findings come with a one-click fix (or use **Fix all**).

| Check | Basis |
| --- | --- |
| Text contrast, with a minimal-change colour fix | WCAG 2.2 SC 1.4.3 (4.5:1, or 3:1 for large text) |
| Advisory perceptual contrast (Lc) | APCA-W3 0.0.98G, proposed for WCAG 3 |
| Contrast of progress and slider indicators | WCAG 2.2 SC 1.4.11 Non-text Contrast |
| Click targets of at least 24 × 24 | WCAG 2.2 SC 2.5.8 Target Size (Minimum) |
| Every input has a visible label (or adds one) | WCAG 2.2 SC 3.3.2 Labels or Instructions |
| Tab order matches reading order (or reorders it) | WCAG 2.2 SC 2.4.3 Focus Order. Reading order comes from **recursive XY-cut** (Nagy & Seth, 1984), so sidebars and two-column forms read correctly. |
| Buttons and toggles have names | WCAG 2.2 SC 4.1.2 Name, Role, Value |
| Overlaps, near-miss alignment, typography sprawl, oversized windows | Layout heuristics after Aalto Interface Metrics (Oulasvirta et al., 2018) |
| Balance and equilibrium scores | Ngo, Teo & Byrne (2003), *Modelling interface aesthetics* |
| Python keywords, duplicates, handler syntax | Real CPython in your browser via Pyodide (downloaded only when you click **Check syntax**), plus pyflakes |

Other research-backed tools:

- **Colour-vision simulation** of protanopia, deuteranopia, tritanopia and achromatopsia uses the physiologically based matrices of Machado, Oliveira & Fernandes (2009), applied in linear RGB. A **squint test** blur checks visual hierarchy.
- **Accessible theme generation** builds a full palette from one colour and guarantees AAA (7:1) body-text contrast and AA button labels.
- **Grid inference** clusters widget edges into rows and columns, in the spirit of UI reverse-engineering work such as REMAUI (Nguyen & Csallner, 2015).
- **Quick Form defaults** follow form-usability findings: top-aligned labels were fastest to complete in Penzo's (2006) eye-tracking study.
- A **Tab order overlay** numbers the focus sequence directly on the canvas.

## Scripting API

The page exposes `window.PyNoCode` for automation and testing:

```js
PyNoCode.generate({ toolkit: "ctk", layout: "grid", structure: "class" }); // Python source
PyNoCode.audit();                    // { errors, warnings, scores, issues[] }
PyNoCode.quickForm("Name\nEmail: email\n[Send]", { labels: "top" });
PyNoCode.loadTemplate("dashboard");
PyNoCode.color.contrastRatio("#777777", "#ffffff"); // 4.48
```

It also offers `getState`, `setState`, `addWidget`, `fixAll`, `readingOrder`, `inferGrid`, `importPython`, `templates`, `buildTemplate`, `undo` and `redo`.

## Testing

`tests/` holds three suites. `tests/run_all.sh` runs all of them, and GitHub Actions runs them on every pull request.

1. `generate_cases.js` runs 72 browser checks (colour science against published APCA and WCAG values, grid inference, Quick Form, the audit, `.py` round-trips and v2-project migration). It then writes every template plus an every-widget "kitchen sink" design in **all 18 toolkit × layout × structure combinations**: 180 Python programs.
2. `ui_checks.js` runs 42 checks that drive the builder with real mouse and keyboard input: palette drag-and-drop, guide snapping, resizing, marquee selection, clipboard, undo, context menu, command palette, Quick Form, test mode, audit fixes, `.py` download and reopen, and autosave.
3. `run_generated.py` executes all 180 programs with **real tkinter and CustomTkinter** under Xvfb. It verifies 1,680 widget positions to the pixel, clicks every button and menu item, calls `get_values()`, and requires pyflakes-clean output.

```bash
npm install --no-save playwright && npx playwright install chromium
python3 -m venv --system-site-packages .venv && .venv/bin/pip install -r tests/requirements.txt
PYTHON=.venv/bin/python bash tests/run_all.sh
```

## Files

```text
pynocode/
├── main.html                 # the whole application
├── tests/                    # browser, UI and real-Tk test suites
├── .github/workflows/        # CI
├── README.md
├── SECURITY.md
└── LICENSE
```

Projects save as `*.pynocode.json` (schema version 3). Projects and autosaves from the previous version are upgraded automatically.

## Roadmap ideas

- Notebook (tabs) and scrollable-frame containers
- Image widgets with bundled assets
- Optional AI-assisted layout from a sketch or description
- Per-widget responsive rules for the Grid export

## License

MIT. See [LICENSE](LICENSE).
