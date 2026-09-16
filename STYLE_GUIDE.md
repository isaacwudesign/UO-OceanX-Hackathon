# Equilibrium Style Guide

Working notes for color and type. **Current** = what is in the lens today. **Decided** = lock it in when you pick a final value (replace TBD / copy Current if you are keeping it).

Lens Studio colors are `vec3` / `vec4` in **0–1**, not 0–255. Hex in this file is the human-readable version.

---

## How to use this file

1. When you pick a color or font, fill the **Decided** column and date it.
2. If Current and Decided disagree, Decided wins — then update the lens to match.
3. Leave TBD rows blank until you decide. Do not delete them.

---

## Brand

| Token | Current | Decided | Notes |
|---|---|---|---|
| Product name | EQUILIBRIUM | | All caps on the intro |
| Logo | `Equilibrium/Assets/Image/equilibrium-logo.png` | | White ribbon mark on the intro |
| Voice / tone | Calm, educational, ocean / restoration | | Optional copy notes go here |

---

## Color

Locked 2026-09-09: **panel / surfaces** = OceanX navy `#0A2540`. **Button + secondary / accent** = OceanX cyan `#00B4E4`.

### UI surfaces

| Token | Hex | LS `vec4` (r, g, b, a) | Current | Decided | Where to change |
|---|---|---|---|---|---|
| Intro panel | `#0A2540` | `0.039, 0.145, 0.251, 1` | OceanX navy | `#0A2540` (2026-09-09) | Inspector → **SceneManager** → Scene Flow → **Intro Frame Color**. Refresh Preview after changing. |
| Surface placement ring | `#0A2540` | `0.039, 0.145, 0.251, 1` | Matches panel navy | `#0A2540` (2026-09-09) | Inspector → **SceneManager** → Scene Flow → **Surface Placement Color**. Tints the floor ring **and** the look-below arrow circle. Do **not** unpack SurfacePlacement. |
| Intro panel (old teal) | `#0C525C` | `0.05, 0.32, 0.36, 1` | Replaced by navy | — | Do not use. |
| Intro panel (old default) | ~grey | UIKit Frame glass | Replaced by navy overlay | — | Do not use. Frame has no color picker. |
| ENTER button | `#00B4E4` | `0, 0.706, 0.894, 1` | OceanX cyan | `#00B4E4` (2026-09-09) | Inspector → **SceneManager** → Scene Flow → **Enter Button Color**. Refresh Preview after changing. Do **not** unpack UIKit. |
| ENTER label | `#FFFFFF` | `1, 1, 1, 1` | White | `#FFFFFF` | **EnterButton** → Text → Fill Color |
| Body / UI text | `#FFFFFF` | `1, 1, 1, 1` | White | `#FFFFFF` | Text components (Temperature labels, C / H) |
| Intro Frame appearance | Large | — | Far-field Frame | | **IntroFrame** → Frame → Appearance |

### Water (temperature challenge)

Defined in `Equilibrium/Assets/Scripts/TemperatureWaterController.ts`. Alpha is always **63%** (`WATER_OPACITY = 0.63`).

| Token | Hex | LS `vec3` (r, g, b) | Meaning | Decided |
|---|---|---|---|---|
| Water — Cold | `#A8EBF4` | `0.658824, 0.921569, 0.956863` | Slider toward Cold | |
| Water — Balanced | `#0CB7FF` | `0.047059, 0.717647, 1.0` | Middle / target | |
| Water — High | `#98CC66` | `0.596078, 0.8, 0.4` | Slider toward High (default at challenge start) | |

### Open color decisions

Use this table for anything not wired yet (accents, coral highlights, success, error).

| Token | Hex | LS vec | Decided? | Used on |
|---|---|---|---|---|
| Accent / secondary | `#00B4E4` | `0, 0.706, 0.894, 1` | Yes — 2026-09-09 | Same as ENTER. Use for other CTAs, highlights, secondary chrome. |
| Background / void | | | TBD | |
| Success / “well done” | | | TBD | |
| Warning / too hot | | | TBD | |
| Coral highlight | | | TBD | |
| Button hover / pressed | derived from `#00B4E4` | SceneManager scales RGB ×1.18 hover / ×0.82 press | Yes — 2026-09-09 | Not a separate picker. Change **Enter Button Color** and these follow. |

---

## Type

Scene Text uses **Roboto**. Files: `Equilibrium/Assets/Roboto-Regular.ttf`, `Roboto-Bold.ttf`.

| Role | Current font | Size | Weight / case | Color | Decided font | Decided size |
|---|---|---|---|---|---|---|
| Intro title | Baked into logo artwork (not a Text component) | — | All caps “EQUILIBRIUM” | White | | |
| ENTER | Roboto Bold | 100 | All caps | White | Roboto Bold | |
| Temperature title | Default | 48 | “Tempature” (as in scene) | White | | |
| Slider end labels (C / H) | Default | 48 | Single letter | White | | |

### Font candidates (fill in when you pick)

| Candidate | Source | License | Notes |
|---|---|---|---|
| | Google Fonts / foundry | | |
| | | | |

To apply a real font later: import a `.ttf` / `.otf` into `Equilibrium/Assets/`, then assign it on each Text component (or we can wire it in script).

---

## UIKit styles in use

| Object | Component | Style / appearance |
|---|---|---|
| IntroFrame | Frame | Appearance **Large**, auto-show/hide off, no close/follow buttons |
| EnterButton | CapsuleButton | **Primary** (fill overridden by SceneManager color), size `30 × 5 × 1` |
| Temperature slider | UIKit Slider | Track `#0A2540`, fill + knob `#00B4E4` (tinted at runtime by TemperatureWaterController) |

---

## Change log

| Date | What | Who |
|---|---|---|
| 2026-08-26 | Intro panel tinted deep ocean teal (`#0C525C`) via SceneManager overlay | |
| 2026-08-28 | Surface placement ring/dots tinted from SceneManager (no package unpack) | |
| 2026-09-13 | Temperature slider track/fill/knob tinted OceanX navy + cyan (no UIKit unpack) | |
| | | |

---

## Quick Inspector map

| Want to change… | Select | Field |
|---|---|---|
| Intro navy panel | **SceneManager** | Scene Flow → Intro Frame Color |
| Surface placement ring | **SceneManager** | Scene Flow → Surface Placement Color |
| ENTER pill color | **SceneManager** | Scene Flow → Enter Button Color |
| Temperature slider colors | *(code)* | `TemperatureWaterController.ts` `SLIDER_NAVY` / `SLIDER_CYAN` |
| ENTER word | **EnterButton** | Text |
| Water cold / mid / hot | *(code)* | `TemperatureWaterController.ts` constants |
| Typeface | Each Text object | Font (currently default) |
