
# pynocode

A web-based drag-and-drop no-code interface for building Tkinter UIs and generating Python code from the layout you create in the browser.

## Overview

`pynocode` is a lightweight browser-based Tkinter UI builder. You drag interface elements into a drop zone, adjust their properties, and generate Python code that reproduces the interface with `tkinter` and `ttk`.

The project currently centers around a single HTML application that provides:

- Drag-and-drop placement of Tkinter-style widgets
- Property editing for text, font color, font size, layout, and function bindings
- Duplicate and remove actions for selected elements
- Window-level settings such as title, icon, always-on-top, and fullscreen
- Python code generation, copy-to-clipboard, and download support

## Features

### Drag and drop UI builder
- Drag elements into a free-positioned drop zone
- Place items visually inside the canvas area
- Reposition widgets by dragging them again

### Editable widget properties
- Change the display text of an element
- Set font color and font size
- Choose layout behavior: `pack` or `grid`
- Configure grid row and column values for grid-based placement

### Button and function support
- Assign predefined button callbacks such as `hello` and `goodbye`
- Add custom Python function code directly in the editor
- Generate code that includes those function definitions in the output script

### Window configuration
- Edit the Tkinter window title
- Set an icon file path
- Enable always-on-top mode
- Enable fullscreen mode

### Code generation workflow
- Generate Python source code from the current design
- Copy generated code to the clipboard
- Download the generated code as a `.py` file

## How it works

1. Open the HTML builder in a browser.
2. Drag UI elements into the drop zone.
3. Click an element to edit its properties.
4. Optionally edit window settings.
5. Click **Generate Python Code**.
6. Copy or download the generated Tkinter script.

## File structure

```text
pynocode/
├── main.html
└── README.md
````

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/kai9987kai/pynocode.git
cd pynocode
```

### 2. Open the builder

Open `main.html` in your browser.

On Linux/macOS:

```bash
open main.html
```

On Windows:

```bash
start main.html
```

## Generated Python output

The generator produces a Tkinter script that imports:

```python
from tkinter import *
from tkinter import ttk
```

It also generates:

* a `Tk()` root window
* default callback functions
* widget declarations for placed elements
* layout calls using `pack()` or `grid()`
* a final `root.mainloop()`

## Notes

* The project is implemented as a single self-contained HTML file with embedded CSS and JavaScript.
* The current codebase is focused on Tkinter UI generation rather than live Python execution.
* If you use custom window icons, the icon path must be valid on the machine running the generated script.
* Custom Python code entered into the builder is inserted into the generated output as-is.

## Roadmap ideas

* Live preview of generated Tkinter layout
* More widget types such as Entry, Checkbutton, Radiobutton, Canvas, and Listbox
* Better drag handles and resizing
* Persisting projects to JSON
* Exporting and importing saved layouts
* Syntax validation for custom Python code
* Improved code formatting and widget naming

## License

This project is licensed under the terms of the repository license.

```

