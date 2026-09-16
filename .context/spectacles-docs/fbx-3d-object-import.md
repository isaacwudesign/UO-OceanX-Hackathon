# FBX, 3D Object Import

Lens Studio supports the import of 3D models in the FBX format. This guide covers how to import an FBX file into a Lens Studio project.

For information on creating an FBX to import, visit the [3D Object Export](./blender-3d-object-export.md) guide.

> **Canonical reference:** [FBX, 3D Object Import | Snap for Developers](https://developers.snap.com/lens-studio/3d/3d-object-import)

---

## Adding the FBX Object

There are two ways to add an FBX resource to your project:

- From the **Asset Browser** panel
- Dragging and dropping

### From the Asset Browser Panel

1. In the Asset Browser panel, select **+ → Import Asset**.
2. Find the FBX file on your computer, and select **Open**.

### Dragging and Dropping

You can drag and drop FBX files from your computer directly into the **Asset Browser** panel or the **Scene Hierarchy** panel.

- If you drag into the **Scene Hierarchy** panel, your FBX will automatically be added to your scene.
- If you drag into the **Asset Browser** panel, your object will only be added as a resource.

To add your model into the scene, open the new folder created by the FBX import, and drag the prefab from the Asset Browser panel into your scene, or Scene Hierarchy panel.

---

## Import Options

Once you add an FBX file to your project, you'll be presented with a panel of FBX Import Options. You can customize these options to configure the imported FBX resource. In most cases, you will not need to change anything.

| Option | Description |
| ------ | ----------- |
| **Use Legacy Importer** | If enabled, Lens Studio will use a different importer. Try this option if you're having issues with the latest importer. |
| **With Materials** | If enabled, materials will be included. |
| **Animation Curve Optimization** | If enabled, applies a size optimization to the model's animation. |
| **Custom animation sampling interval** | The frame rate of the imported animation (defaults to 30 frames per second). |
| **Import vertex color** | If enabled, includes vertex color information. |
| **Import tangents and binormals** | If enabled, includes tangent and binormal information. |
| **Regenerates tangents and binormals** | If enabled, Lens Studio will generate new tangent and binormal information. |
| **Import blend shape animation** | If enabled, includes blend shape animation. For more information on playing back mesh animations, visit the guide on Playing 3D Animation. |
| **Import vertex animation** | If enabled, includes vertex animation. For more information, visit the Vertex Animation guide and the Playing 3D Animation guide. |
| **Generate pivots** | If enabled, includes Scene Objects in the hierarchy that recreate the model's transform pivots. Otherwise, all model pivots will be placed at the world origin. |
| **Regenerate normals for skinned meshes** | If enabled, the normals of the model's skinned meshes will be recalculated. |
| **Triangulate NURBS** | If enabled, NURBS surfaces and curves in this object will be triangulated. |
| **Use legacy FBX loader** | If enabled, the object will be loaded with an older version of the FBX loader. |

---

## Scene Object

Once the FBX is imported into Lens Studio, you should see it listed in your **Scene Hierarchy** panel as a new object added to the scene.

It will also appear in your **Scene** panel, where it can be manipulated.

---

## Resources

Your model's resources (meshes, textures, materials, and animations) will now be available in the **Asset Browser** panel.

If your FBX fails to import, check the **Logger** panel for an import error message. For more information, review the [3D Object Export](./blender-3d-object-export.md) guide.
