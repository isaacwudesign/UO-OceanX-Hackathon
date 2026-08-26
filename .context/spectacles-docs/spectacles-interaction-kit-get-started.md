# Get started with Spectacles Interaction Kit (SIK)

**Spectacles Interaction Kit (SIK)** is a set of Lens Studio components, modules, and assets that speed up **Spectacles** development by providing common building blocks for interactive AR.

> **Canonical reference:** [Get started with Interaction Kit | Snap for Developers](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/get-started)

**Lens Studio:** [Download](https://ar.snap.com/download) the latest **Lens Studio 5** build compatible with your target.

**Changes in SIK:** [SIK release notes](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/release-notes).

---

## Starting a new Spectacles project (Base Template)

On the Lens Studio home screen, under **Build with Starter Templates**, choose:

**Spectacles → Base Template**

That template is **preconfigured** with Spectacles Interaction Kit and other Spectacles-oriented settings.

---

## Importing SIK into a new project (manual setup)

Use this path when you are **not** using the Base Template and want to add SIK yourself.

1. **Create** a new Lens Studio project.

2. Open **Window → TypeScript Status** so you can see when TypeScript compilation finishes.

3. On the **Camera** object, add **Device Tracking** and set tracking mode to **World**.

4. **Project Info → Platform Settings:** set **Lens is made for** → **Spectacles**.

5. In **Preview**, set **Device Type Override** → **Spectacles**.

6. Install SIK: **Window → Asset Library → Spectacles → Spectacles Interaction Kit** (install the current version).

7. In the **Asset Browser**, click **+** (add asset). Open the **Installed Packages** tab and select **SpectaclesInteractionKit** to import the package.

8. When **TypeScript Status** shows compilation **complete**, click **Refresh** on the **Preview** panel.

9. *(Optional)* **Unpack** the package: right-click **SpectaclesInteractionKit** → **Unpack**. This lets you edit SIK internals directly but can make **upgrades** harder—prefer keeping it packed unless you know you need unpack.

10. From the Asset Browser, drag this prefab into the **Scene Hierarchy**:

    `Assets/SpectaclesInteractionKit/Prefabs/SpectaclesInteractionKit.prefab`

    > **Warning:** Do **not** drop the prefab into the scene until TypeScript compilation is **fully complete**. Doing it early can produce a **broken prefab** with missing script references.

11. If you do not need the sample content, **disable or delete** the **`[EXAMPLES]`** objects in the hierarchy.

12. **Save** the project.

---

## Upgrading SIK in an existing project

1. Open the project and wait until TypeScript compilation has **finished**.

2. In the **Asset Browser**, right-click the **SpectaclesInteractionKit** package. If **Pull Update from Library** appears, choose it.

3. To check versions manually: **Asset Library → Spectacles → SpectaclesInteractionKit**. Install a newer (or specific) version if needed, then right-click the package again and use **Pull Update from Library** so the project picks up the library copy.

After an upgrade, **compilation errors** can appear if APIs changed. Read the **[release notes](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/release-notes)** and update your code accordingly.
