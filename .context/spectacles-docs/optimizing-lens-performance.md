# Optimizing Lens Performance

If your lens is running slowly or dropping frames, it may need optimization. This document summarizes guidance for optimizing lenses **specifically for Spectacles**.

> **Canonical reference:** [Optimizing Lens Performance | Snap for Developers](https://developers.snap.com/spectacles/best-practices/performance-optimization/optimizing-lens-performance)

**General Lens Studio optimization** (may differ from Spectacles-specific advice in places): [Performance optimization guide — best practices](https://developers.snap.com/lens-studio/publishing/optimization/performance-optimization-guide#best-practices-for-lens-optimization). When guidance conflicts, treat **Spectacles** documentation as authoritative for Spectacles builds, and **always verify** optimizations after you make them.

---

## Lens Developer Sandbox

When Lenses consume excessive power and generate high thermal output, Spectacles **throttles** performance elements such as rendering and FPS to keep runtime behavior consistent across workloads. That behavior acts as a guardrail: it quickly surfaces when a Lens needs optimization.

---

## Identifying the need for optimization

Check performance using either:

- The on-device **Performance Overlay**, or  
- The **Lens Studio Spectacles Monitor** panel.

**Setup guides**

- [Lens Performance Overlay](https://developers.snap.com/spectacles/best-practices/profiling/lens-performance-overlay)
- [Spectacles Monitor Panel](https://developers.snap.com/spectacles/best-practices/profiling/spectacles-monitor)

With the Lens running on device, watch **Lens Power (LP)** on the overlay or **Power Usage** in the monitor. Both measure overall power on a scale from **0** to **100**, where:

- **0** ≈ empty Lens  
- **100** ≈ maximum recommended power for smooth performance  

Aim for the **lowest** power that still meets your experience goals. If the reading **exceeds 100**, the Lens will likely perform poorly.

---

## Pinpointing unoptimized elements

While monitoring:

1. Point the device at different parts of your Lens and note power.  
2. Compare to power when those elements are **not** in view.

If power **jumps** when a specific element is visible, that element probably needs **rendering** optimizations.

If power stays high **regardless of view**, or the experience stutters when certain **logic** runs, focus on **scripting** optimizations.

---

## Rendering optimizations

Rendering work is about reducing **how much** and **how expensively** you draw.

- **Disable invisible or unused meshes** — Invisible meshes can still render. Disable them, move them out of the frustum until needed, or destroy them if they will not be used again.

- **Reduce draw calls and materials** — Use **instancing** when drawing the same mesh many times. Combine textures into **atlases** so one material with different UVs can texture multiple meshes.

- **Avoid expensive materials and lighting** — Limit **PBR** materials, reduce **light** count, and avoid heavy effects such as **reflections**, **shadows**, and **environment maps** where you can.

- **Reduce complexity** — Fewer mesh **vertices**, lighter **shader** work, fewer and smaller **textures** (often **512×512 or smaller** is recommended), and consider turning **off MSAA** if it is enabled and costly.

---

## Scripting optimizations

For CPU cost, run a **[Perfetto trace](https://developers.snap.com/spectacles/best-practices/profiling/spectacles-monitor#perfetto)** and inspect functions that take a large share of time. Then consider:

- **Limit `UpdateEvent`s** — Use them only when needed; avoid heavy work inside them.

- **Minimize resource creation** — Create only the **Events**, **SceneObjects**, **Assets**, and **Components** you need; **reuse** what you can.

- **Reduce physics usage** — Add physics bodies only where necessary; use **broad-phase** checks before expensive work.

- **Optimize calculations** — **Precompute** or cache stable values; move work to the **GPU** when possible; avoid heavy **trigonometry** and large **dataset** operations in JS/TS.

- **Manage data and logs** — Avoid repeatedly saving **large** data and **excessive** logging. Prefer **WAV** over **MP3** for audio on Spectacles when you can, and limit **simultaneous** sounds.

---

## Additional considerations

No single checklist fixes every Lens. Optimization needs **measurement** and **iteration**. Use these tips **together**, look for **parallel** opportunities (similar bottlenecks elsewhere), and expect to try more than one pass — persistence usually pays off.
