# Equilibrium

An interactive **Spectacles** lens built for the **OceanX Hackathon**. Place coral pieces on a reef, restore balance to the ecosystem, and adjust water temperature to bring the habitat back to equilibrium.

Built with **Lens Studio 5.15.4** · **Spectacles Interaction Kit** · **Spectacles UI Kit**

---

## Experience Overview

1. **Intro** — Welcome UI and voice-over guide the user into the experience.
2. **Surface placement** — The reef platform is placed on a real-world surface.
3. **Coral placement** — Grab coral pieces and snap them onto the reef (nearest free slot).
4. **Temperature balance** — Use the slider to adjust water temperature and restore the reef.
5. **Reward** — Clownfish return and the experience completes when balance is restored.

---

## Requirements

| Tool | Version |
|---|---|
| [Lens Studio](https://ar.snap.com/lens-studio) | 5.15.4 or newer |
| [Git](https://git-scm.com/) | Any recent version |
| [Git LFS](https://git-lfs.com/) | Required for 3D assets, audio, and packages |
| [Cursor](https://cursor.com/) | Optional — for AI-assisted development |

**Target device:** Snap Spectacles

---

## Getting Started

### 1. Clone the repository

```bash
git lfs install
git clone https://github.com/isaacwudesign/UO-OceanX-Hackathon.git
cd UO-OceanX-Hackathon
```

If assets look missing after cloning, run:

```bash
git lfs pull
```

### 2. Open in Lens Studio

1. Launch **Lens Studio**
2. **File → Open Project**
3. Select `Equilibrium/Equilibrium.esproj`
4. Wait for TypeScript to compile and packages to load (first open may take a minute)

### 3. Preview on Spectacles

Pair your Spectacles device and push the lens from Lens Studio, or use the Spectacles preview workflow in Lens Studio.

---

## Project Structure

```
UO-OceanX-Hackathon/
├── README.md
├── .cursor/rules/              # Cursor AI rules for Lens Studio
├── .context/spectacles-docs/   # Spectacles reference docs (for Cursor)
└── Equilibrium/                # Lens Studio project
    ├── Equilibrium.esproj
    ├── Assets/
    │   ├── Scripts/            # TypeScript components
    │   ├── Scene.scene
    │   ├── 3D Assets/
    │   └── Audio/
    └── Packages/               # Snap packages (SIK, UIKit, etc.)
```

**Not tracked in git** (rebuilt locally by Lens Studio): `Cache/`, `Workspaces/`, `Support/`, lock files.

---

## Scripts

| Script | Purpose |
|---|---|
| `SceneManager.ts` | Orchestrates intro, placement flow, voice-over timing, and scene phases |
| `CoralSnapManager.ts` | Registers snap slots and places corals on the nearest free point |
| `CoralSnapPiece.ts` | Per-coral grab/release and snap interaction |
| `TemperatureWaterController.ts` | Maps temperature slider to water color and balance logic |
| `ClownfishOrbit.ts` | Clownfish orbit animation after the reef is restored |

---

## Packages

- **SpectaclesInteractionKit** — Hand interaction, grab, manipulation
- **SpectaclesUIKit** — UI frames, sliders, toggles
- **SurfacePlacement** — Real-world surface detection and placement
- **SnapDecorators** — TypeScript `@component` / `@input` decorators
- **Utilities** — Shared Snap utilities

---

## Cursor Setup (Optional)

To use the same AI development setup across machines:

1. Open the **`UO-OceanX-Hackathon`** folder (repo root) in Cursor — not just `Equilibrium/`
2. The `.cursor/rules/` folder provides Lens Studio–aware AI guidance
3. The `.context/spectacles-docs/` folder gives the agent Spectacles API reference

**Note:** Lens Studio MCP must be configured separately on each machine (it is not stored in this repo).

---

## Syncing Between Machines

```bash
# Pull latest changes
git pull

# After making changes locally
git add .
git commit -m "Describe your change"
git push
```

Use **GitHub Desktop** if you prefer a visual workflow — add this repo folder and push/pull from there.

---

## Author

**Isaac Wu** — [isaacwudesign](https://github.com/isaacwudesign)

Built for the **OceanX Hackathon** · Spectacles × Lens Studio
