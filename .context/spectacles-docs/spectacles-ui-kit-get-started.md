# Get started with Spectacles UI Kit (SUIK)

**Spectacles UI Kit (SUIK)** is a set of components, utilities, and assets for building **interactive AR UIs** on **Spectacles**. It aligns with system UI patterns and works alongside [**Spectacles Interaction Kit (SIK)**](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/get-started) for input. It is aimed at beginners but stays **extensible** for advanced setups.

> **Canonical reference:** [Get started with UI Kit | Snap for Developers](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/get-started)

**Design ↔ build**

- **Designers:** [Snap OS 2.0 Design Kit](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/snap-os-design-kit) (Figma)—tokens, styles, and components for mocks.  
- **Developers:** **Spectacles UI Kit** (this Lens Studio package)—implement those designs in Lens Studio.

Both follow the same design language so mockups and shipped UI stay consistent.

**Updates:** SUIK changes often—check the **[release notes](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/release-notes)**.

---

## Adding UI Kit to your Spectacles project

If you do not already have a Spectacles Lens, create one with the **[Spectacles Lens setup guide](https://developers.snap.com/spectacles/get-started/start-building/spectacles-lens-setup#create-a-lens-project)**.

### Install the package

1. In Lens Studio: **Window → Asset Library**.  
2. Search for **`Spectacles UI Kit`**.  
3. Click **Install** on the **SpectaclesUIKit** package.

### Explore the example

1. In the **Resources** panel, open the **SpectaclesUIKit** package.  
2. Drag the **`ExampleInterface`** prefab into the **Scene Hierarchy**.  
3. Use the **Preview** panel to see the sample UI and how pieces fit together.

### Next steps

- Browse **component** docs in the Spectacles UI Kit section of Snap for Developers (e.g. [Button](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/components/Button) as a starting point; use the site sidebar for the full list).  
- **[Customize visuals](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/custom-visual)**  
- **[Extend components](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/extend-component)**

---

## Upgrading SUIK in an existing project

1. Open the project and wait until **TypeScript compilation** has finished.  
2. In the **Asset Browser**, right-click the **SpectaclesUIKit** package. If **Pull Update from Library** is available, select it.

**Manual check:** **Asset Library → Spectacles → SpectaclesUIKit**—install a newer or specific version if needed, then right-click the package again and choose **Pull Update from Library**.

Upgrades can introduce **API changes** and compile errors. Read the **[release notes](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/release-notes)** and update your scripts as needed.
