---
name: CipherCanvas
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#baccb0'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#ffffff'
  on-secondary: '#003737'
  secondary-container: '#00fbfb'
  on-secondary-container: '#007070'
  tertiary: '#fff9f8'
  on-tertiary: '#67001d'
  tertiary-container: '#ffd3d5'
  on-tertiary-container: '#c3003f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#00fbfb'
  secondary-fixed-dim: '#00dddd'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b8'
  on-tertiary-fixed: '#40000f'
  on-tertiary-fixed-variant: '#91002d'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.1'
  code-snippet:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  grid-size: 32px
---

## Brand & Style

This design system is built on the principles of **Techno-Industrial Brutalism**. It prioritizes high-density information display and technical precision over consumer-friendly softness. The aesthetic targets computer engineers, cryptographers, and security analysts who require a UI that feels like a powerful command center or a high-tech radar array.

The visual narrative is "The Digital Workbench"—a space where raw code and complex data are the primary inhabitants. Key characteristics include:
- **Raw Utility:** Every element serves a functional purpose, mirroring the efficiency of a terminal.
- **Cybernetic Contrast:** The interplay between a void-like background and vibrant, high-energy light sources.
- **Structural Integrity:** Heavy reliance on visible grids and rigid frameworks that suggest a physical, industrial hardware origin.

## Colors

The palette is optimized for low-light environments and long-duration cognitive focus.

- **Backgrounds:** The primary surface is near-black (#0a0a0a), minimizing eye strain. Secondary surfaces use a slightly lighter neutral (#1a1a1a) to create depth without losing the "void" feel.
- **Neon Green (#39FF14):** Reserved for primary actions, success states, and active data streams. It represents "system nominal" and active execution.
- **Cyan (#00FFFF):** Used for analytical overlays, secondary navigation, and informational readouts. It provides a colder, more precise contrast to the green.
- **Alert Red (#FF0055):** A high-vibrancy magenta/red used exclusively for critical errors, security breaches, and cryptographic failures.
- **Grays:** Muted, desaturated mid-tones are used for grid lines and inactive labels to ensure they do not compete with critical data.

## Typography

Typography in this design system is exclusively monospaced, utilizing **JetBrains Mono**. This choice ensures that data columns align perfectly, maintaining the visual rhythm of a terminal.

- **Alignment:** All text should adhere to a strict baseline grid.
- **Casing:** Headlines and labels frequently use uppercase to reinforce the industrial, urgent tone.
- **Density:** Information density is high; avoid excessive line-height in data-heavy views.
- **Styling:** Bold weights are used for emphasis and hierarchical distinction, never for decorative flair. Use character-spacing adjustments for labels to increase legibility at small sizes.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy. Interfaces are built on a 4px base unit, with a visible background grid set to 32px intervals.

- **The HUD Layout:** Dashboards should be treated as a "Head-Up Display." Content is contained within sharp-edged modules that fit into a 12-column system.
- **Gutters:** Standard 16px gutters between modules to maintain separation of concerns.
- **Subtle Background Grids:** Use 1px thin lines in a low-opacity gray (#1a1a1a) to render the underlying grid, giving the user a sense of architectural structure.
- **Breakpoints:**
    - Mobile (< 600px): Single column, stacked modules.
    - Tablet (600px - 1024px): 6-column grid.
    - Desktop (> 1024px): Full 12-column grid with side-panel navigation.

## Elevation & Depth

Depth is conveyed through **chromatic layering and luminescence** rather than traditional shadows.

- **Tonal Layers:** The primary interface level is the background. Active modules are elevated using a 1px border of #1a1a1a.
- **Glow States:** Interaction and focus are signaled by "Outer Glows" (neon dropshadows with 0 spread and high blur) in the primary accent color.
- **Scanlines & Overlays:** Use semi-transparent scanline patterns or noise textures on top-level modals to simulate a CRT or high-end diagnostic monitor.
- **Borders:** All elevation is reinforced by 1px solid borders. No soft shadows are permitted; if an element is "above" another, it is indicated by a brighter border or a slight increase in background luminosity.

## Shapes

The shape language is strictly **Rectilinear**.

- **Zero Radius:** All corners must be 90 degrees. There are no exceptions for buttons, cards, or inputs. This reinforces the industrial, machined feel of the software.
- **Chamfered Edges:** For specialized UI elements (like primary action buttons or tab headers), use a 45-degree "clipped corner" (mask-image or clip-path) to suggest high-tech hardware fabrication.
- **Dividers:** Horizontal and vertical rules should be used frequently to categorize data, mimicking a schematic or blueprint.

## Components

### Buttons
- **Default:** Transparent background, 1px Primary Green border, uppercase Monospace text.
- **Hover/Active:** Solid Primary Green background, black text, with a 5px blur neon glow in the same color.
- **Clipped:** Use a 4px chamfer on the top-right and bottom-left corners for "Critical Action" buttons.

### Inputs
- **Terminal Style:** Single-line bottom border or a full ghost-border box.
- **Cursor:** Use a blinking block cursor (`_`) at the end of active text fields.
- **Focus:** The entire border and the label text should shift to Primary Cyan when the field is active.

### Cards & Modules
- **Data Modules:** Sharp boxes with a subtle "ID Tag" in the top-left corner (e.g., `MOD_01`, `CRYPT_READOUT`).
- **Background:** Subtle dark-gray gradient (top-down) to suggest a recessed surface.

### Status Indicators
- **Radar Blips:** Small circular indicators (the only circular elements allowed) that pulse for live data updates.
- **Progress Bars:** Segmented blocks (e.g., `[|||||||---]`) rather than smooth continuous fills.

### Navigation
- **Side Rail:** Collapsible vertical rail with icon + label. Active states are indicated by a 2px vertical line on the leading edge in Cyan.
- **Breadcrumbs:** Represented as file paths (e.g., `root / lab_01 / canvas_04`).