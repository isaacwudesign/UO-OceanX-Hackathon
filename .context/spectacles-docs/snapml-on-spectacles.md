# SnapML on Spectacles

SnapML brings machine learning to Spectacles: computer vision, object detection, and related tasks inside your AR experiences. This note summarizes the **end-to-end workflow** Snap documents for training a custom model (YOLOv7-style pipeline) with **Paperspace** and **Roboflow**, exporting **ONNX** for SnapML, and implementing detection in **Lens Studio**—including the Spectacles **Multi-Object Detection** template architecture.

> **Canonical reference:** [SnapML on Spectacles | Snap for Developers](https://developers.snap.com/spectacles/about-spectacles-features/snapML)

Snap ML for Spectacles extends the general SnapML story used for the Snapchat app. See [SnapML overview](https://developers.snap.com/lens-studio/features/snap-ml/ml-overview).

**Third-party tools:** Snap suggests [Paperspace](https://www.paperspace.com/) and [Roboflow](https://roboflow.com/) / [Roboflow app](https://app.roboflow.com/) for **learning** in this tutorial. **Snap does not endorse** those vendors; you can substitute comparable cloud GPU + dataset tooling.

**Samples:** [specs-devs/samples](https://github.com/specs-devs/samples) includes notebooks and Lens Studio examples.

---

## Overview

SnapML lets you run ML models in Spectacles Lenses. The documented path adapts the **Multi-Object Detection** material from the [SnapML templates repo](https://github.com/Snapchat/snapml-templates/tree/main) using a cloud dev machine and managed datasets.

### High-level phases

1. **Setup** — development environment (e.g. Paperspace)  
2. **Data preparation** — dataset versioning / export (e.g. Roboflow, YOLOv7 layout)  
3. **Training** — custom **YOLOv7** (typically **transfer learning** from pretrained weights)  
4. **Export** — **ONNX** with SnapML-oriented options (`--export-snapml`, etc.)  
5. **Deployment** — import into **Lens Studio** and run on **Spectacles**  

### Model training pipeline (six steps)

| Step | Focus |
| ---- | ----- |
| 1 | Setup Paperspace (or equivalent) |
| 2 | Prepare dataset |
| 3 | Set up YOLOv7 fork / branch for SnapML export |
| 4 | Train |
| 5 | Export to ONNX for SnapML |
| 6 | Import into Lens Studio |

The live doc expands each step (kernels, Roboflow export format, class maps, etc.).

---

## Quick start (condensed)

Typical shell flow (paths and dataset names are placeholders—match your project):

```bash
# 1. Environment (e.g. Paperspace PyTorch template)
git clone https://github.com/Snapchat/snapml-templates.git
git clone https://github.com/hartwoolery/yolov7
cd yolov7
git checkout export-snapml
pip install -r requirements.txt

# 2. Dataset in YOLOv7 format (Roboflow or other)
pip install --upgrade roboflow
# Use your Roboflow API / export to populate your-dataset/

# 3. Pretrained weights
wget https://github.com/WongKinYiu/yolov7/releases/download/v0.1/yolov7-tiny.pt

# 4. Train
python train.py --data your-dataset/data.yaml --cfg cfg/training/yolov7-tiny.yaml \
  --weights yolov7-tiny.pt --img 224 224 --batch-size 64 --epochs 200 \
  --name detection --device 0 --hyp data/hyp.scratch.tiny.yaml

# 5. Export ONNX for SnapML
python export.py --weights runs/train/detection/weights/best.pt --grid \
  --simplify --export-snapml --img-size 224 224 --max-wh 224

# 6. Lens Studio: import ONNX, wire ML Component, set class mappings (see official guide)
```

---

## Prerequisites

- **Cloud GPU environment** (e.g. [Paperspace](https://www.paperspace.com/)) or equivalent  
- **Dataset tooling** (e.g. [Roboflow](https://roboflow.com/)) or equivalent labeling / export pipeline  

### Why this workflow?

| Traditional ML | SnapML-oriented flow (as in Snap’s doc) |
| -------------- | ---------------------------------------- |
| Heavy local setup | Cloud templates / notebooks |
| Manual aug / versioning | Managed dataset exports (e.g. Roboflow) |
| Train huge models from scratch | **Transfer learning** from small YOLO checkpoints |
| Extra mobile conversion steps | **Direct ONNX** path tuned for SnapML |
| Custom AR glue | **Lens Studio** templates and scripting |

---

## Workflow steps (detail on the official site)

On [SnapML on Spectacles](https://developers.snap.com/spectacles/about-spectacles-features/snapML), open each section for full instructions and screenshots:

1. Setting up the Paperspace environment  
2. Preparing the dataset with Roboflow  
3. Setting up YOLOv7 for training (fork / `export-snapml` branch)  
4. Training  
5. Exporting for SnapML (ONNX, `--export-snapml`, NMS behavior)  
6. Using the model in Lens Studio (import, ML Component, Spectacles template)  

---

## Advanced topics

### Non-maximum suppression (NMS)

**NMS** is **post-processing**, not a trainable conv layer: filter by confidence, sort boxes, suppress overlapping duplicates.

For YOLO → ONNX for SnapML, **`--export-snapml`** keeps NMS **out** of the exported graph; **Lens Studio / JavaScript** reimplements NMS so you can tune behavior and stay compatible with Spectacles.

### Model optimization tips

- Prefer **small** variants (e.g. **YOLOv7-tiny**).  
- Lower **input resolution** when latency matters.  
- **Fewer classes** when possible.  
- Use **quantization** when the export path supports it.  
- **Validate on device** on Spectacles hardware.  

---

## Troubleshooting (summary)

**Paperspace**

- **Restart kernel** — clears Python state; keeps installed packages; use after `%pip install`.  
- **Restart space** — full reset; only when the machine is broken.  

**GPU OOM**

- Smaller **batch size**, smaller **model**, lower **resolution**, `torch.cuda.empty_cache()` between steps.  

**Export**

- Pin dependency versions from the template repo.  
- `--simplify` needs **`onnx-simplifier`**.  
- Protobuf issues: e.g. `pip install protobuf==3.20.3` (version per Snap’s current doc).  

---

## FAQ (abridged)

**Best model traits for Spectacles**

- Small file size (Snap often cites **~10MB** Lens budget for ML assets in related ML docs—confirm current limit in Lens Studio).  
- Low **FLOPs** / simple architecture.  
- **Quantized** weights when possible.  
- **YOLOv7-tiny** and **MobileNet**-style backbones are common recommendations.  

**How many objects?**

- Many boxes can be scored, but for performance Snap suggests roughly **3–5** concurrent detections as a comfort zone, up to **~10** with care; tune **NMS** and max-object caps in Lens Studio.  

**Better accuracy**

- More / more diverse data, cleaner boxes, augmentation, longer training, hyperparameter tuning, temporal smoothing / thresholds in the Lens.  

**Other model types**

- SnapML also supports other tasks (classification, segmentation, style transfer, pose, etc.); **export** details change, Lens Studio workflow stays conceptually similar.  

---

## Lens Studio implementation (Spectacles)

After ONNX export, implement in Lens Studio for Spectacles. Follow the **[SnapML Multi-Object Detection template / samples](https://github.com/specs-devs/samples)** alongside the long-form guide.

### Script architecture (names from Snap’s doc)

**Core detection**

- **`MLSpatializer`** — ties ML output to 3D space  
- **`YOLODetectionProcessor`** — turns raw tensors into detections  
- **`DetectionVisualizer`** — debug / viz in 3D  

**Camera / geometry**

- **`PinholeCapture`** — camera input  
- **`PinholeCameraModel`** — 2D ↔ 3D math  

**Layout / motion**

- **`MatchTransform`** / **`MatchTransformLocal`** — relative placement  
- **`InBetween`** — interpolate between two anchors  
- **`SmartTether`** — follow user / scene motion  

The official guide walks through: import & test → spatialization → smoothing → custom logic.

### Extended pipeline (training + Lens)

| Step | Action |
| ---- | ------ |
| 1 | Environment setup |
| 2 | Dataset prep |
| 3 | Train |
| 4 | ONNX export |
| 5 | Import model |
| 6 | Spatialization (`MLSpatializer`, etc.) |
| 7 | Custom interaction logic |

---

## Resources

| Resource | URL |
| -------- | --- |
| SnapML on Spectacles (this workflow) | https://developers.snap.com/spectacles/about-spectacles-features/snapML |
| SnapML templates | https://github.com/Snapchat/snapml-templates |
| YOLOv7 (upstream) | https://github.com/WongKinYiu/yolov7 |
| Hartwoolery fork (export branch used in guide) | https://github.com/hartwoolery/yolov7 |
| Roboflow docs | https://docs.roboflow.com/ |
| Lens Studio / SnapML (ML overview) | https://developers.snap.com/lens-studio/features/snap-ml/ml-overview |
| ML Component overview | https://developers.snap.com/lens-studio/features/snap-ml/ml-component/ml-component-overview |
| Spectacles guides | https://docs.snap.com/spectacles/guides/overview |
| Sample projects | https://github.com/specs-devs/samples |

---

## Closing notes

Custom **object detection** on Spectacles follows: **dataset → train (YOLOv7-tiny + transfer learning) → SnapML ONNX export → Lens Studio ML + template scripts** for spatialization and UX. Cloud notebooks and Roboflow-style tooling lower friction; **Paperspace / Roboflow are illustrative**, not mandatory.

Iterate on **architecture**, **data**, **thresholds**, and **3D placement** on hardware to keep experiences responsive and accurate. For every command, flag, and UI step, treat the **[official SnapML on Spectacles](https://developers.snap.com/spectacles/about-spectacles-features/snapML)** page as the source of truth—this file is a **structured summary** for your `.context` docs.
