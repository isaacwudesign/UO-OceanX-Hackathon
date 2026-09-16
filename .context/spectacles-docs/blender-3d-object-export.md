# Blender, 3D Object Export

This guide walks through how to use Blender to export a 3D model to the FBX format so that it can be imported into Lens Studio. This guide uses **Blender 2.79**. Any 3D tool that can export to FBX should be able to export models that can be imported into Lens Studio.

> **Canonical reference:** [Blender, 3D Object Export | Snap for Developers](https://developers.snap.com/lens-studio/3d/3d-object-export)

---

## Export for Lens Studio

1. In Blender, select the object or objects you want to export.
2. Select **File → Export → FBX (.fbx)**.

---

## Export Settings

In the Blender Export dialog, use the following settings.

### Main

The default settings in the **Main** tab should work for your export.

### Geometries

Select the following settings in the **Geometries** tab:

- **Apply Modifiers**
- **Use Modifiers Render Setting**

### Armatures

The default settings in the **Armatures** tab should work for your export.

### Animation

Select **Baked Animation** in the **Animation** tab and optionally these two settings:

- **Key All Bones**
- **Force Start/End Keying**

If your scene has multiple animation Actions (known in Lens Studio as Animation Layers), check **All Actions** to ensure they import properly into Lens Studio.

---

## Asset limits for Lens Studio and Snapchat

Ensure the following when exporting 3D assets so they work best in Lens Studio and Snapchat:

- Your scene total of 3D assets should add up to **less than 10,000 triangles** (5,000 polys assuming your model is built with quads). This will allow your model to display smoothly across the widest variety of Android and iPhone devices.
- In general, stay under **100 joints** for your animation rig. Additionally, while the engine does support Blend Shape animation, try to avoid using it. If Blend Shapes are required, use sparingly and pay close attention to your frame rate performance.
- Lens Studio supports up to a **4 bones per vertex** limit. If the influence is greater than 4 then there will be problems in your rigged model when imported into Lens Studio.

---

## Textures

To ensure that your model's textures are imported automatically to Lens Studio, save your textures in the same folder as your exported FBX. For example, if your project is located at:

```
/Users/user.name/ExportedModels/MyModel.fbx
```

save your textures in:

```
/Users/user.name/ExportedModels/
```

3D model textures should be **square**. The width and height of your texture should be a **power of 2** (e.g. 128, 256, 512, or 1024). If your model has only one color, try to lower the resolution to **8 × 8**.

---

## Scene Settings

Lens Studio's target animation frame rate is **30 frames per second**. To ensure that the timing of your imported animation plays back correctly in Lens Studio, set the frame rate of your Blender scene to 30 fps.

You can set the frame rate in Blender under the scene settings in the default view.

---

## More Information

You now have an exported FBX file that's ready to be imported into Lens Studio. For information on importing 3D models into Lens Studio, review the [3D Object Import](https://developers.snap.com/lens-studio/3d/3d-object-import) guide.
