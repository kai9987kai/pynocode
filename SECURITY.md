# Security Policy

## Supported versions

Only the latest version of `main.html` on the `main` branch receives fixes.

## How the builder handles your data

- PyNoCode Builder is a single static HTML file. It has no server and no accounts, and it collects no analytics.
- Your project is autosaved to your own browser's `localStorage`. **Save** and **Download .py** create files on your machine only.
- The only network requests happen when you click **Check syntax** / **Check Python**. That downloads Pyodide (CPython compiled to WebAssembly) from `cdn.jsdelivr.net`, and pyflakes from PyPI, so the generated code can be compiled locally in your browser. The code itself is never uploaded.
- Python you type in the **Code** tab is copied verbatim into the exported file and runs when *you* run that file. Only open or run `.py` and `.pynocode.json` files from sources you trust.

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button on the repository's *Security* tab, rather than in a public issue. Include steps to reproduce and the browser you used. You should get an acknowledgement within 7 days. Once a fix is available it will be published and credited to you, unless you would rather stay anonymous.
