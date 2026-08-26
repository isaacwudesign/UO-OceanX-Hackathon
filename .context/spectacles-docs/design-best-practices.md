# Design Best Practices

UX and comfort guidelines for Spectacles experiences.

> **Canonical reference:** [Design Best Practices | Snap for Developers](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/design-best-practices) — use that page for diagrams, templates, and updates.

Related guides:

- [Positioning & Sizing Content](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/positioning-sizing-content) (includes **X axis & binocular overlap**)
- [UI Design](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/ui-design) (includes **color & material** guidance)

---

## UX recommendations

Avoid common issues by following these best practices:

- **Consider user movement and postures** — Account for different postures and movements during your experience. Provide adjustable controls where possible, and ensure users can recall or summon any critical UI.

- **Guide users for out-of-view elements** — Provide hints to look down or around to find hand menus, elements on the floor, or anything outside the field of view.

- **Explain divergent interactions** — Clearly explain interactions that differ from typical system patterns. Only use diverging patterns if they add value. Leverage system patterns as much as possible to reduce the learning curve.

- **Show targeting feedback** — Ensure all interactive elements display targeting feedback.

- **Follow target sizing guidelines** — Adhere to the recommended target sizing for interactive elements (see official positioning & sizing docs).

- **Design for visual comfort** — Follow visual comfort guidelines to improve the user experience (see **Designing for comfort → Visual comfort** below).

---

## Designing for comfort

### Visual comfort

- **Avoid non-overlapping monocular side regions** — Do not place important content in the non-overlapping, monocular side regions of the display. Review the **X axis & binocular overlap** material in [Positioning & Sizing Content](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/positioning-sizing-content).

- **Optimal viewing distance** — Detailed content is most comfortable at roughly **1 meter** in Z-depth. Avoid prolonged viewing of detailed content very close to the user.

- **Single focus** — Do not require users to focus on both virtual and real objects at two very different depths at once. Allow focus on **one** depth or the other.

- **Consistent depth cues** — Keep depth cues between the real world and virtual content consistent with reality. Avoid setting a high render order in Lens Studio for virtual objects that are positioned far from the user; that “digital override” can make far-field virtual content appear nearer than near-field content, conflict with real-world depth cues, and cause discomfort.

- **Center content** — Center content in the field of view to minimize color variation near the display edges.

- **Avoid dark content on pure white backgrounds** — This pairing can cause visual discomfort. Review the **color & material** guidance in [UI Design](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/ui-design).

- **Legible text** — Provide a background behind text so it stays readable against varying real-world colors and other virtual objects. Options include gradient panels or occluding materials.

- **Consider user breaks** — Some users remove Spectacles periodically. Prefer self-paced experiences and support pausing or saving progress where it makes sense.

### Physical comfort

- **Reduce arm effort** — Place elements lower on **Y** to reduce arm effort for hand targeting.

- **Minimize travel distance** — For lower-effort hand targeting, lay out interactions to shorten travel between targets. Avoid long sequences of actions that are far apart.

- **Design custom hand gestures for comfort** — Prefer neutral hand and wrist positions aligned with natural resting poses. Avoid awkward grasps or extreme angles. Allow a **range** of acceptable poses instead of a single rigid pose.

- **Avoid steep neck angles** — Keep content neutrally placed and centered in the field of view to avoid sustained extreme neck flexion or extension.

### Cognitive comfort

Design for **reduced cognitive load** and clearer understanding.

- **Match real-world conventions and human behavior** — Interfaces that mirror familiar real-world patterns feel intuitive and lean on existing mental models.

- **Recognition over recall** — Make options **visible** so users can recognize what they need. Recognition is less demanding than recalling options from memory.

- **Provide a first-run experience** — Use guided intros, tutorials, or tooltips for first-time users to build confidence and reduce frustration.

- **Avoid overwhelming the user** — Do not fill the entire field of view; leave margins on all sides. Avoid navigating across many windows at once (more than **three** can feel overwhelming). Prefer shorter lists — avoid more than **seven** elements when possible.

---

## Resources

| Resource | Description |
| -------- | ----------- |
| **Snap OS 2.0 Design Kit** | Figma component library with tokens, styles, components, and reference screens. |
| **Recommended display & button sizing** | `SizeTemplate.fbx` — use the asset referenced in Snap’s design / sizing documentation alongside Lens Studio. |

For the latest download links and file locations, use the [Design Best Practices](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/design-best-practices) page on Snap for Developers.
