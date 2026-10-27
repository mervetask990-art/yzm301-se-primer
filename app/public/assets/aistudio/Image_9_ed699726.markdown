---
name: Nocturne Engineer
colors:
  surface: '#071425'
  surface-dim: '#071425'
  surface-bright: '#2e3a4d'
  surface-container-lowest: '#030e20'
  surface-container-low: '#101c2e'
  surface-container: '#142032'
  surface-container-high: '#1f2a3d'
  surface-container-highest: '#2a3548'
  on-surface: '#d7e3fc'
  on-surface-variant: '#bdc9c6'
  inverse-surface: '#d7e3fc'
  inverse-on-surface: '#253144'
  outline: '#889390'
  outline-variant: '#3e4947'
  surface-tint: '#81d5ca'
  primary: '#81d5ca'
  on-primary: '#003732'
  primary-container: '#5fb3a8'
  on-primary-container: '#00433d'
  inverse-primary: '#006a61'
  secondary: '#fbba6d'
  on-secondary: '#472a00'
  secondary-container: '#764800'
  on-secondary-container: '#fbba6d'
  tertiary: '#c5c1f9'
  on-tertiary: '#2e2b58'
  tertiary-container: '#a39fd5'
  on-tertiary-container: '#383563'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9df2e6'
  primary-fixed-dim: '#81d5ca'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#ffddb9'
  secondary-fixed-dim: '#fbba6d'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#663e00'
  tertiary-fixed: '#e3dfff'
  tertiary-fixed-dim: '#c5c1f9'
  on-tertiary-fixed: '#181542'
  on-tertiary-fixed-variant: '#444171'
  background: '#071425'
  on-background: '#d7e3fc'
  surface-variant: '#2a3548'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

The design system establishes a calm, distraction-free environment tailored for late-night technical learning and deep intellectual focus. It serves software engineers, computer science students, and practitioners studying dense technical material during off-hours, winding down, or working night shifts. 

The emotional signature is quiet, reassuring, and atmospheric—reminiscent of working in a peaceful personal study past midnight. Instead of the sterile, high-glare ergonomics of conventional developer dashboards or the hyper-gamified styling of casual learning apps, this interface evokes an introspective reading and terminal environment. 

The aesthetic is flat, low-contrast, and luminescent:
- **Visual Style:** Minimalist night-mode editorial with fine-line structural borders and muted ambient glows rather than physical drop shadows.
- **Iconography & Emblems:** Ultra-fine 1.25px–1.5px stroke icons, anchored by a stylized lantern motif that signifies steady, warm illumination through complex concepts.
- **Rhythm & Touch:** Calibrated strictly for mobile ergonomic ease, preserving breathing room with comfortable 48px touch targets to prevent eye and finger fatigue.

## Colors

The palette is tuned specifically for low-lux conditions, prioritizing eye comfort and hierarchical legibility across code blocks, interactive queries, and technical prose.

### Base Roles
- **Canvas / Background (`#0F1B2D`):** Deep abyssal midnight base, suppressing blue-light fatigue while maintaining structural presence.
- **Surface / Container (`#17263C`):** Subdued elevation for standard cards, reading modules, and code snippet containers.
- **Active / Selected Surface (`#1F3150`):** Elevated fill for active choices, highlighted list items, and selected chips.
- **Structural Stroke / Outlines (`#2A3E5C`):** Quiet structural separation lines across all card perimeters, input edges, and divider rules.

### Accents & Semantic Roles
- **Primary Action (`#5FB3A8`):** Muted seafoam sage. Reserved strictly for primary navigation, execution triggers, and progress markers. Always paired with dark ink (`#0F1B2D`) for button labels to guarantee high legibility without white-glare bloom.
- **Warm Anchor (`#F2B266`):** Soft candlelight amber used sparingly for focus session timers, clock indicators, active reading streaks, and key architectural highlights.
- **Lavender Tutor (`#A7A3D9`):** Gentle dusk lavender designated for inline hints, tutor dialogs, collapsible tooltips, and explanatory annotations.
- **Functional Success (`#7BC8A4`):** Soft verification green for passing unit tests and completed modules.
- **Functional Danger (`#E58A7B`):** Desaturated coral red for syntax errors, test failures, and critical resets.

### Typography Ink
- **Text Primary (`#E8EEF5`):** High-readability cool silver, avoiding pure 100% white to reduce ocular strain over sustained reading sessions.
- **Text Secondary (`#9FB0C3`):** Subdued slate gray for metadata, code comments, captions, and inactive tab labels.

## Typography

Typography establishes an editorial atmosphere that balances structural clarity with reading comfort:
- **Headings (Plus Jakarta Sans):** Geometric yet gentle letterforms soften technical headers and chapter milestones while retaining contemporary sharpness.
- **Body & Prose (Inter):** Highly neutral and legible for technical explanations, algorithm descriptions, and comprehension paragraphs. Generous line-height ratios (1.55 to 1.625) prevent dense code commentary from feeling overwhelming on small screens.
- **Code & Indicators (JetBrains Mono):** Dedicated to syntax samples, timers, metadata tags, and system labels. Consistent glyph widths ensure alignment for debugging tables, execution logs, and numeric countdowns.

## Layout & Spacing

The layout is built for single-handed mobile navigation (viewport width 390px) using an anchored single-column fluid frame bounded by fixed exterior gutters.

### Geometry & Grids
- **Outer Canvas Margins:** Strict `20px` (`1.25rem`) horizontal margins on left and right borders ensure elements do not collide with screen bezels.
- **Internal Column Gutter:** `16px` (`1rem`) between side-by-side elements or interactive parameter splits.
- **Vertical Stack Rhythm:** Standardized on multiples of 4px/8px:
  - Micro-gaps between headers and their sub-labels: `space-xs` (4px).
  - Gaps within tightly paired controls (e.g., input labels to fields): `space-sm` (8px).
  - Spacing between adjacent list cells and cards: `space-md` (12px).
  - Spacing between distinct thematic sections: `space-lg` (20px) to `space-xl` (28px).

### Touch Constraints
Interactive elements adhere to a strict minimum hit box of `48px x 48px`, even when the visual icon or label occupies a smaller footprint.

## Elevation & Depth

To sustain a calm night-shift environment, the system rejects standard drop shadows, high-blur ambient glows, and skeumorphic bevels. Visual stacking relies exclusively on flat tonal layers combined with low-contrast structural strokes:

1. **Base Layer (Level 0):** Pure `#0F1B2D`. Houses viewports, full-page backgrounds, and root view containers.
2. **Surface Layer (Level 1):** Solid `#17263C` with a crisp 1px stroke of `#2A3E5C`. Used for chapter modules, code execution sandboxes, and instructional cards.
3. **Selected / Interactive Layer (Level 2):** Fill transitions to `#1F3150` with the 1px stroke remaining `#2A3E5C` (or subtly glowing to `#5FB3A8` at 40% opacity when focused).
4. **Overlay / Drawer Layer (Level 3):** Modal sheets, hint drawers, and menu popovers utilize `#17263C` with a continuous 1px `#2A3E5C` border, laid over a translucent veil (`#0A121E` at 80% opacity).

## Shapes

The geometric framework applies precise, distinct radii per functional component class:
- **Cards & Primary Modules:** `16px` border-radius creates smooth, enclosed reading frames that feel approachable and modern.
- **Action Buttons & Inputs:** `14px` border-radius produces comfortable, tactile tap targets distinct from surrounding content cards.
- **Chips, Badges, & Tags:** Fully pill-shaped (`9999px`) to create clear shape contrast against rectangular text blocks and code cards.
- **Code Sandboxes & Inline Terminal Windows:** `12px` to `16px` matching external card modules.

## Components

### Buttons
- **Primary Button:** Background `#5FB3A8`, text color `#0F1B2D` (`JetBrains Mono`, 13px, weight 600). Minimum height 48px, horizontal padding 20px, border-radius 14px. No shadow. Active state darkens slightly to `#529F95`.
- **Secondary / Ghost Button:** Background transparent, 1px border `#2A3E5C`, text color `#E8EEF5`. Hover/Pressed state fills to `#1F3150`.
- **Warm / Focus Timer Button:** Background `#F2B266`, text color `#0F1B2D`, height 48px, border-radius 14px. Used specifically for timed focus sprint actions.

### Chips & Badges
- **Pill Filter / Concept Chip:** Full rounded pill (`rounded-full`). Background `#17263C`, border 1px `#2A3E5C`, text `#9FB0C3` (`JetBrains Mono`, 11px).
- **Selected Chip:** Background `#1F3150`, border 1px `#5FB3A8`, text `#5FB3A8`.
- **Tutor / Hint Badge:** Background `rgba(167, 163, 217, 0.15)`, text `#A7A3D9`, 1px border `rgba(167, 163, 217, 0.3)`.

### Cards & Reading Modules
- **Standard Card:** Background `#17263C`, border 1px `#2A3E5C`, padding 16px to 20px, border-radius 16px.
- **Active / Focus Card:** Background `#1F3150`, border 1px `#5FB3A8`.
- **Interactive Quiz Option:** Background `#17263C`, border 1px `#2A3E5C`, border-radius 16px, min-height 52px, vertical center-aligned text. On select: fill `#1F3150`, border `#5FB3A8`.

### Lists & Chapter Rows
- **List Container:** Separated list items with `space-sm` gaps, or grouped inside a `#17263C` card with 1px `#2A3E5C` internal dividers.
- **Row Anatomy:** Left icon/chapter number (`JetBrains Mono`, `#9FB0C3`), center title (`Plus Jakarta Sans`, 15px, `#E8EEF5`), right progress indicator or status pill. Minimum row height 52px.

### Inputs & Terminal Shells
- **Text Inputs:** Background `#0F1B2D`, border 1px `#2A3E5C`, radius 14px, height 48px, padding 0 16px. Text `#E8EEF5` (`Inter`, 14px). Focus ring: 1px `#5FB3A8` without outward glow.
- **Code Terminal Block:** Background `#0F1B2D`, border 1px `#2A3E5C`, radius 14px, internal padding 16px. Font `JetBrains Mono` 13px, line-height 20px. Syntax highlighted using `#5FB3A8` (keywords), `#F2B266` (functions/values), and `#A7A3D9` (types/decorations).

### Checkboxes & Radio Controls
- **Radio Buttons:** Circular 20px ring, border 1.5px `#2A3E5C`. Selected: border `#5FB3A8`, filled center dot 10px `#5FB3A8`.
- **Checkboxes:** 20px box, border-radius 6px, border 1.5px `#2A3E5C`. Checked: background `#5FB3A8`, inner icon `#0F1B2D`. Touch target padded out to 48px square.

### Brand Emblem & Night-Shift Utilities
- **Lantern Emblem:** Displayed in the top app navigation bar (size 24px) rendered in `#F2B266` fine-stroke line work.
- **Night-Shift Clock Banner:** Persistent or collapsible top bar strip displaying elapsed study duration and time, styled strictly in `JetBrains Mono` 12px using warm accent `#F2B266`.