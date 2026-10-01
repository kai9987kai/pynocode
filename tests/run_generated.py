#!/usr/bin/env python3
"""Execute every Python file produced by tests/generate_cases.js with real Tk.

For each case this:
  * compiles the file and (if installed) runs pyflakes on it,
  * runs it with tkinter / customtkinter, replacing mainloop() with a probe that
    checks every widget sits at its designed pixel position (place layouts),
    invokes every button and menu command, and calls get_values(),
  * fails on any exception, including ones raised inside Tk callbacks.

Needs a display: run under ``xvfb-run -a -s "-screen 0 1920x1080x24"`` on CI.

Usage: python tests/run_generated.py [cases_dir] [--jobs N] [--filter TEXT]
"""

import argparse
import concurrent.futures
import glob
import json
import os
import subprocess
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))


def walk(widget):
    yield widget
    for child in widget.winfo_children():
        yield from walk(child)


def probe(root, namespace, spec, errors, report):
    root.update_idletasks()
    root.update()

    def lookup(name):
        if spec["structure"] == "class":
            return getattr(root, name, None)
        return namespace.get(name)

    tolerance = 2 if spec["layout"] == "relative" else 1
    checked = 0
    for name, (x, y, width, height) in spec["expect"].items():
        widget = lookup(name)
        if widget is None:
            errors.append("widget %r was not created" % name)
            continue
        actual = (widget.winfo_x(), widget.winfo_y(), widget.winfo_width(), widget.winfo_height())
        if any(abs(a - e) > tolerance for a, e in zip(actual, (x, y, width, height))):
            errors.append("%s: geometry %s != designed %s" % (name, actual, (x, y, width, height)))
        checked += 1
    report["geometry_checked"] = checked

    window_size = (root.winfo_width(), root.winfo_height())
    if spec["layout"] != "grid" and window_size != tuple(spec["window"]):
        errors.append("window is %s, designed %s" % (window_size, tuple(spec["window"])))

    clicked = 0
    for widget in list(walk(root)):
        if type(widget).__name__ in ("Button", "CTkButton") and hasattr(widget, "invoke"):
            widget.invoke()
            clicked += 1
    report["buttons_invoked"] = clicked

    menu_name = root.cget("menu") if "menu" in root.keys() else ""
    invoked_menu = 0
    if menu_name:
        menubar = root.nametowidget(menu_name)
        for index in range((menubar.index("end") or 0) + 1):
            if menubar.type(index) != "cascade":
                continue
            submenu = root.nametowidget(menubar.entrycget(index, "menu"))
            last = submenu.index("end")
            for item in range((last if last is not None else -1) + 1):
                if submenu.type(item) == "command" and submenu.entrycget(item, "label").lower() not in ("exit", "quit", "close"):
                    submenu.invoke(item)
                    invoked_menu += 1
    report["menu_items_invoked"] = invoked_menu

    get_values = lookup("get_values")
    if get_values is not None:
        values = get_values()
        if not isinstance(values, dict):
            errors.append("get_values() returned %r" % type(values))
        report["values"] = {key: repr(value) for key, value in values.items()}
    root.update()


def run_case(py_path):
    """Runs in a fresh interpreter (see main) so Tk state never leaks between cases."""
    import io
    import contextlib
    import tkinter

    spec = json.load(open(py_path[:-3] + ".json"))
    source = open(py_path, encoding="utf-8").read()
    errors = []
    report = {"case": os.path.basename(py_path)}

    def report_callback_exception(self, exc, value, tb):
        errors.append("callback error: " + "".join(traceback.format_exception(exc, value, tb)))

    tkinter.Tk.report_callback_exception = report_callback_exception
    namespace = {"__name__": "__main__", "__file__": py_path}
    probed = []

    def fake_mainloop(self, n=0):
        probed.append(True)
        try:
            probe(self, namespace, spec, errors, report)
        except Exception:
            errors.append("probe failed: " + traceback.format_exc())
        finally:
            try:
                self.destroy()
            except Exception:
                pass

    tkinter.Misc.mainloop = fake_mainloop
    stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout):
            exec(compile(source, py_path, "exec"), namespace)
    except Exception:
        errors.append("script raised: " + traceback.format_exc())
    if not probed:
        errors.append("mainloop() was never reached")
    report["stdout_lines"] = len(stdout.getvalue().splitlines())
    report["errors"] = errors
    print(json.dumps(report))
    return 1 if errors else 0


def pyflakes_messages(py_path):
    try:
        from pyflakes.api import check
        from pyflakes.reporter import Reporter
    except ImportError:
        return None
    import io

    out, err = io.StringIO(), io.StringIO()
    check(open(py_path, encoding="utf-8").read(), py_path, Reporter(out, err))
    return [line for line in (out.getvalue() + err.getvalue()).splitlines() if line.strip()]


def execute(py_path, python):
    lint = pyflakes_messages(py_path)
    # CustomTkinter copies its fonts into ~/.fonts on every import; parallel
    # processes sharing one HOME truncate files others have mmapped (SIGBUS).
    with tempfile.TemporaryDirectory(prefix="pynocode-home-") as home:
        env = dict(os.environ, HOME=home)
        proc = subprocess.run([python, os.path.abspath(__file__), "--case", py_path], capture_output=True, text=True, timeout=120, env=env)
    lines = [line for line in proc.stdout.splitlines() if line.startswith("{")]
    try:
        report = json.loads(lines[-1])
    except (IndexError, ValueError):
        report = {"case": os.path.basename(py_path), "errors": ["runner crashed (exit code %s):\n%s%s" % (proc.returncode, proc.stdout[-2000:], proc.stderr[-4000:])]}
    noise = [line for line in proc.stderr.splitlines() if line.strip()]
    if noise:
        report.setdefault("errors", []).append("stderr:\n" + "\n".join(noise[-20:]))
    if lint:
        report.setdefault("errors", []).append("pyflakes:\n" + "\n".join(lint))
    report["pyflakes"] = "skipped" if lint is None else "clean" if not lint else "issues"
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cases", nargs="?", default=os.path.join(HERE, ".out"))
    parser.add_argument("--jobs", type=int, default=max(1, min(8, os.cpu_count() or 1)))
    parser.add_argument("--filter", default="")
    parser.add_argument("--case")
    args = parser.parse_args()

    if args.case:
        sys.exit(run_case(args.case))

    paths = sorted(p for p in glob.glob(os.path.join(args.cases, "*.py")) if args.filter in os.path.basename(p))
    if not paths:
        print("No cases found in %s. Run: node tests/generate_cases.js" % args.cases)
        sys.exit(2)

    failures = []
    stats = {"geometry_checked": 0, "buttons_invoked": 0, "menu_items_invoked": 0}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for report in pool.map(lambda p: execute(p, sys.executable), paths):
            ok = not report.get("errors")
            for key in stats:
                stats[key] += report.get(key, 0)
            print(("PASS " if ok else "FAIL ") + report["case"] + ("" if ok else "\n    " + "\n    ".join(report["errors"])[:4000]))
            if not ok:
                failures.append(report["case"])

    print("\n%d/%d generated programs ran cleanly with real Tk (%d widget positions verified, %d buttons and %d menu items invoked)."
          % (len(paths) - len(failures), len(paths), stats["geometry_checked"], stats["buttons_invoked"], stats["menu_items_invoked"]))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
