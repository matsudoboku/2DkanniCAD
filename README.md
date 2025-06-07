# 2DkanniCAD

This project is a simple 2D CAD web application. It provides drawing, editing and dimensioning tools inside a single page and is implemented entirely in HTML, CSS and JavaScript.

## UI Overview

The main layout can be found in [`index.html`](index.html). The page is organised as follows:

- A set of tabs for different tool groups (draw, edit, dimension and file).
- A toolbar containing buttons that change depending on the active tab.
- A canvas element used as the drawing surface.

The look and placement of these elements are defined by the CSS styles in the same file. To customise the layout you can directly modify the HTML structure or the corresponding CSS rules.

## Adapting the Layout

You can tailor the interface to mimic other styles such as "v-nas" by adjusting the HTML/CSS. Examples of customisations include:

- Moving the toolbar vertically to the side of the canvas.
- Adding a bottom status bar to display coordinates or messages.
- Changing the colour scheme to match your preferred palette.

Editing the markup or styles allows you to arrange the controls in any configuration that suits your workflow.
