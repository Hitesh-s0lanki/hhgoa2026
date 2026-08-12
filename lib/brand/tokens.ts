/**
 * Brand tokens — the single source of truth for colour and type.
 *
 * Values are the real ones, read out of hhgoa.com's production CSS
 * (see docs/13-brand-identity.md). Two consumers depend on them:
 *
 *   - the Tailwind theme in `app/globals.css` (UI chrome)
 *   - the canvas renderer (artwork), from T-013 onwards
 *
 * The CSS copy is checked against this file by tests/unit/brand-tokens.test.ts,
 * so the website's green and the exported PNG's green cannot drift apart.
 */

export const brand = {
  color: {
    /** Deep forest green. The ground — roughly 70% of every surface. */
    primary: "#0B6839",
    /** Bright yellow. Display type, the sun, focus rings. */
    accent: "#FEE101",
    /** Hot magenta. CTAs and one spot accent per surface. */
    pink: "#FF0080",
    /** Warm cream. Muted body text on green. */
    offwhite: "#FFFBE8",
    white: "#FFFFFF",
    /** Offset shadows only — never a fill. */
    black: "#000000",
  },

  /**
   * UI-only shades. Derived, not extracted: the site is a single flat green,
   * but an app needs one recessed surface so an input well reads as a well.
   * Deliberately kept out of `color` so template specs cannot reach for them —
   * artwork stays on the six official colours.
   */
  ui: {
    /** Recessed panel / photo well, one step under `primary`. */
    deep: "#073F23",
  },

  font: {
    display: { family: "Bowlby One SC", weight: 400, file: "/branding/fonts/display.woff2" },
    body: { family: "DM Mono", weight: 500, file: "/branding/fonts/body.woff2" },
  },

  /** The site's signature move: a hard black offset behind yellow display type. */
  shadow: { offset: { dx: 0.004, dy: 0.004, color: "#000000" } },

  /**
   * `ui` is 0 by design: the UI is square, and a rounded control in it reads as
   * a control from a different site. `photo` is the exception — it belongs to
   * the pass artwork (the arched photo window), not to the chrome.
   */
  radius: { photo: 0.04, ui: "0rem" },

  isPlaceholder: false,
} as const;

/**
 * Contrast notes, so nobody has to re-derive them (ratios vs. `primary`):
 * white 7.6:1 · offwhite 7.3:1 · accent 6.9:1 — all safe for body text.
 * pink is 1.8:1 on green and 3.8:1 under white — it is a *fill* and a
 * large-display colour, never small text. Black on pink is 5.6:1, which is
 * why the primary CTA is black-on-pink rather than white-on-pink.
 */
export const UNSAFE_ON_GREEN = [brand.color.pink] as const;
