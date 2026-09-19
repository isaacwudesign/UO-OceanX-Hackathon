# Equilibrium

An interactive **Spectacles** experience built for the **OceanX Hackathon**. Place a reef in the real world, restore it by hand, and work through the stresses that bleach coral, pollute the water, and empty the sea of fish.

Built in **Lens Studio 5.15.4** with **Spectacles Interaction Kit** and **Spectacles UI Kit**.

---

## The experience

Wear Spectacles. Pinch **ENTER**, then place the tank on a real surface.

1. **Welcome** — Intro panel, logo, and voice-over.
2. **Place the reef** — A navy ring marks a surface; pinch to set the aquarium.
3. **Rebuild the coral** — Pinch nine pieces from the platform onto the tank floor. Misses return home.
4. **Temperature** — The water runs too hot. Corals bleach and the clownfish slow. Drag the slider to the middle to restore color and motion.
5. **Plastic** — Pinch trash out of the tank.
6. **Overfishing** — Push the boats off the water with an open palm.
7. **Close** — A thank-you beat when the habitat is back in balance.

Facts and knowledge panels sit beside each challenge. UI uses OceanX navy (`#0A2540`) and cyan (`#00B4E4`).

---

## Open the project

| | |
|---|---|
| [Lens Studio](https://ar.snap.com/lens-studio) | 5.15.4 or newer |
| [Git LFS](https://git-lfs.com/) | Required for meshes, audio, and Snap packages |
| Device | Snap Spectacles |

```bash
git lfs install
git clone https://github.com/isaacwudesign/UO-OceanX-Hackathon.git
cd UO-OceanX-Hackathon
git lfs pull
```

In Lens Studio: **File → Open Project** → `Equilibrium/Equilibrium.esproj`. Wait for TypeScript and packages to finish loading, then preview on Spectacles.

---

## Project layout

```
UO-OceanX-Hackathon/
├── README.md
└── Equilibrium/                 # Lens Studio project
    ├── Equilibrium.esproj
    ├── Assets/
    │   ├── Scripts/
    │   ├── Scene.scene
    │   ├── 3D Assets/
    │   ├── Image/
    │   └── Audio/
    └── Packages/                # SIK, UIKit, SurfacePlacement, …
```

`Cache/`, `Workspaces/`, and `Support/` are local Lens Studio output and are not in git.

---

## Scripts

| Script | Role |
|---|---|
| `SceneManager.ts` | Intro, surface placement, beat order, billboards, and voice-over |
| `CoralSnapPiece.ts` | Grab, drop, and home-return for each coral |
| `CoralSnapManager.ts` | Tank-floor snap and “all nine placed” |
| `TemperatureWaterController.ts` | Slider, glass tint, coral bleach, fish speed |
| `TrashPickupManager.ts` | Pinch-to-collect pollution |
| `OverfishingBoatPushManager.ts` | Palm-push boats off the water |
| `ClownfishOrbit.ts` | Clownfish circle (slows when the tank is stressed) |
| `SnapAudio.ts` | Mix-to-Snap, mute, and capture-safe playback |

---

## Packages

- **Spectacles Interaction Kit** — Hands, pinch, grab, palm
- **Spectacles UI Kit** — Intro frame, ENTER button, temperature slider
- **Surface Placement** — Real-world floor targeting
- **SnapDecorators** — `@component` / `@input`
- **Utilities** — Shared Snap helpers

---

## Author

**Isaac Wu** · [isaacwudesign](https://github.com/isaacwudesign)

OceanX Hackathon · Spectacles × Lens Studio
