---
name: Arcade Stadium
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#ffca45'
  on-secondary: '#3f2e00'
  secondary-container: '#e4ae00'
  on-secondary-container: '#5b4400'
  tertiary: '#bcc7de'
  on-tertiary: '#263143'
  tertiary-container: '#8691a7'
  on-tertiary-container: '#1f2a3c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#ffdf9a'
  secondary-fixed-dim: '#f7be1d'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4300'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-xl:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  card-gap: 20px
---

## Brand & Style
The design system is engineered to evoke the high-octane energy of a midnight stadium. It targets a gaming audience within Discord, prioritizing a "premium arcade" feel that balances competitive intensity with accessible luxury.

The style is a fusion of **Glassmorphism** and **Cinematic High-Contrast**. It utilizes deep, atmospheric layering to create depth, where surfaces feel like suspended glass over a vast, illuminated arena. Visual cues are taken from high-end sports broadcasting—sharp lines, glowing accents, and a focus on "hero" moments—ensuring that every interaction feels like a win.

## Colors
The palette is rooted in the depth of a night-sky navy, providing a canvas for high-energy accents.

*   **Primary (Neon Purple):** Used for magic moments, rare card tiers, and primary interactive states. It represents the "energy" of the game.
*   **Secondary (Electric Gold):** Reserved for prestige, currency, legendary achievements, and the most critical call-to-action (CTA).
*   **Surface Colors:** Semi-transparent variations of slate and navy are used to create the glassmorphic tiers.
*   **Accents:** Vibrancy is maintained through glows and gradients rather than flat fills, ensuring the "arcade" shimmer is present across the UI.

## Typography
Typography is treated as a core graphic element. **Montserrat** provides the aggressive, geometric weight needed for titles and headings, often set in All-Caps to mimic sports jerseys and scoreboard graphics. 

**Inter** handles all functional data and body text, ensuring maximum legibility on mobile screens and within the compact Discord Activity frame. High contrast between weights is encouraged to maintain hierarchy in information-dense views like player stats.

## Layout & Spacing
The layout follows a **structured fluid grid** optimized for the 16:9 aspect ratio of Discord activities. 

*   **Central Focus:** The layout prioritizes a "Triptych" model for the home screen—a large hero center for the primary action (Find Match) flanked by secondary modules (Packs/Decks).
*   **Discord Constraints:** Margins are kept generous (min 24px) to ensure UI elements do not clip against Discord's native overlays. 
*   **Mobile Reflow:** On mobile, the triptych stacks vertically into a scrollable feed, with the "Find Match" CTA remaining pinned or prominently at the top.

## Elevation & Depth
Elevation in this design system is achieved through **optical transparency** rather than traditional dropshadows.

1.  **Level 0 (Base):** Dark navy gradients with subtle grain/particle textures to simulate stadium air.
2.  **Level 1 (Surface):** Glassmorphic containers with 20% opacity and a 16px backdrop blur. These feature a 1px inner border (top-left weighted) to simulate glass thickness.
3.  **Level 2 (Active):** Interactive elements use soft outer glows (`box-shadow` with high spread and low opacity) in the component's accent color (Purple or Gold) to appear "powered on."

## Shapes
The shape language is bold and modern. While the system uses a standard `rounded-lg` (16px) for most secondary elements, primary containers and hero cards utilize **24px+ corner radii** to emphasize a friendly yet high-end feel.

Buttons and badges utilize a "Squircle" approach or fully rounded pill shapes to contrast against the sharp, geometric lines of the football cards themselves.

## Components
### Buttons
*   **Primary (Hero):** Solid Gold (#EAB308) gradient, bold black text, heavy rounded corners. Includes a subtle pulse animation for "Find Match."
*   **Secondary:** Glassmorphic fill with Purple (#A855F7) borders and white text.

### Cards & Packs
*   Cards utilize a vertical aspect ratio with a slight 3D tilt effect on hover. 
*   Rare cards should feature a "shimmer" overlay effect and a thicker, glowing border.

### Input & Controls
*   **Input Fields:** Deep navy base, translucent, with a bottom-only purple border that glows upon focus.
*   **Chips/Badges:** Small, high-contrast labels (e.g., card ratings) set in Montserrat Bold with a dark background and bright accent text.

### Navigation
*   A bottom-docked navigation bar using blurred glass backgrounds and monochromatic icons that light up in Gold when active.