# Snap Cloud examples (Asset Library package)

The **SnapCloud Examples** package ships in the **Lens Studio Asset Library**. It includes **six** ready-to-run Lens setups that each highlight a major **Snap Cloud** capability. Every example is meant to run **on its own** on Spectacles.

**How to use it**

1. In Lens Studio, open the **Asset Library** and search for **`SnapCloud Examples`**.  
2. Import the package into a **new or existing** project.  
3. Drag one of the **example scenes** into the **Hierarchy**.  
4. Each scene is **self-contained**; connect your **Supabase Project** asset (from the Supabase plugin) as required by that scene.

Related docs:

- [**Asset Library** (Spectacles)](https://developers.snap.com/spectacles/about-spectacles-features/asset-library) — where packages like this are distributed.  
- [**Getting started with Snap Cloud**](https://developers.snap.com/spectacles/about-spectacles-features/snap-cloud/getting-started) — prerequisite setup below.

---

## Prerequisites

All examples assume you have already:

- Installed **SupabaseClient** and the **Supabase plugin** (from the Asset Library).  
- Created a **Supabase Project** asset via **Import Credentials** in the plugin.

Follow the getting started guide end-to-end before running these scenes.

---

## Sections (how the package is organized)

The package is grouped into **four** areas that mirror typical Lens workflows:

| Section | What it covers |
| -------- | ---------------- |
| **Basic setup** | Authentication, databases, storage, realtime, and edge functions. **Start here.** |
| **Media** | Image, video, and audio capture with upload to **Supabase Storage**. |
| **Leaderboard** | Global scores using **server-side RPC** patterns. |
| **Lens & web app** | A full **Lens + companion web app** wired through Snap Cloud. |

Package naming and scene titles in Lens Studio may differ slightly from this summary; use the Asset Library listing and in-editor README hints as the live source of truth.
