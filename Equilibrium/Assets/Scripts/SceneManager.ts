/**
 * Orchestrates intro UI, welcome VO, surface placement, and placing instruction VO.
 * Optimized for Spectacles: event-driven flow, no per-frame work outside placement watch.
 */
import { Example } from "SurfacePlacement.lspkg/Example";
import { CircleAnimation } from "SurfacePlacement.lspkg/Scripts/CircleAnimation";
import { Horizontal } from "SurfacePlacement.lspkg/Scripts/Horizontal";
import { SingleSurface } from "SurfacePlacement.lspkg/Scripts/SingleSurface";
import { HandHintsController } from "SurfacePlacement.lspkg/Scripts/HandHintsController";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractionPlane } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractionPlane/InteractionPlane";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { CapsuleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import {
  GradientParameters,
  RoundedRectangle,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";
import { RoundedRectangleVisual } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import { AppearFade } from "./AppearFade";
import { DeviceDelay } from "./DeviceDelay";
import { TemperatureWaterController } from "./TemperatureWaterController";
import { CoralSnapPiece } from "./CoralSnapPiece";
import { TrashPickupManager } from "./TrashPickupManager";
import { OverfishingBoatPushManager } from "./OverfishingBoatPushManager";
import {
  applyAmbientMix,
  applyMuteMix,
  applyPlayMix,
  bindSnapCaptureMute,
  enableMixToSnap,
  isSnapRecording,
  playCapturedVoice,
} from "./SnapAudio";

const OCEAN_AMBIENT_NAME = "Ocean_Background_SFX";
/** Draw hands before Ocean_Water_Wave (render order 3) so the surface does not slice the mesh. */
const HAND_RENDER_ORDER = 2;
const OCEAN_AMBIENT_VOLUME = 0.2;
/** Hold a steady look at the floor ring to lock placement. Pinch does not confirm it. */
const LOOK_LOCK_SECONDS = 4;
const LOOK_LOCK_MOVE_CM = 45;
/** Hit-test jitter must last this long before the countdown restarts. */
const LOOK_LOCK_BREAK_SECONDS = 0.35;

const PLACEMENT_COLOR_PROPS = [
  "circleColor",
  "CircleColor",
  "dotsColor",
  "DotsColor",
  "yellowColor",
  "YellowColor",
  "yellowcolor",
];

enum ScenePhase {
  Intro = 0,
  Placing = 1,
  Placed = 2,
}

@component
export class SceneManager extends BaseScriptComponent {
  @ui.group_start("Scene Flow")
  @input
  @hint("Intro UI frame shown at lens start")
  introFrame: SceneObject;

  @input
  @allowUndefined
  @hint("ENTER CapsuleButton on the intro (EnterButton)")
  enterButton: SceneObject;

  @input
  @hint("SurfacePlacement Example component (autoStart should be off)")
  surfacePlacement: Example;

  @input
  @hint("Content root enabled after successful placement (VisualParent)")
  placedVisuals: SceneObject;

  @input
  @hint("Clownfish orbit group, hidden until all corals are placed")
  clownfishCircling: SceneObject;

  @input
  @hint("Placement surface hidden after After Placing VO finishes")
  platform: SceneObject;

  @input
  @allowUndefined
  @hint("Tempature Scenarios group. Keep this OFF in the editor; children stay ON.")
  temperatureScenarios: SceneObject;

  @input
  @allowUndefined
  @hint("Temperature UI shown after After Placing VO finishes")
  temperatureSlider: SceneObject;

  @input
  @allowUndefined
  @hint("Facts panel shown with the temperature slider")
  temperatureFactsFrame: SceneObject;

  @input
  @allowUndefined
  @hint("Knowledge panel shown with the temperature slider")
  temperatureKnowledgeFrame: SceneObject;

  @input
  @allowUndefined
  @hint("Temperature challenge (water tint / VO). Mesh tint is optional.")
  temperatureWater: TemperatureWaterController;

  @input
  @allowUndefined
  @hint("Trash Scenarios group. Disabled until temperature Solve VO finishes.")
  trashScenarios: SceneObject;

  @input
  @allowUndefined
  @hint("TrashPickupManager on Trash Scenarios")
  trashPickup: TrashPickupManager;

  @input
  @allowUndefined
  @hint("Overfishing Scenarios group. Keep OFF in the editor; children stay ON.")
  overfishingScenarios: SceneObject;

  @input
  @allowUndefined
  @hint("OverfishingBoatPushManager on Overfishing Scenarios")
  overfishingPush: OverfishingBoatPushManager;

  @input
  @allowUndefined
  @hint("Billboard copy group Pinch_Coral. Keep OFF in the editor; children stay ON.")
  billboardPinchCoral: SceneObject;

  @input
  @allowUndefined
  @hint("Billboard copy group Temperature. Keep OFF in the editor; children stay ON.")
  billboardTemperature: SceneObject;

  @input
  @allowUndefined
  @hint("Billboard copy group Trash. Keep OFF in the editor; children stay ON.")
  billboardTrash: SceneObject;

  @input
  @allowUndefined
  @hint("Billboard copy group Overfishing. Keep OFF in the editor; children stay ON.")
  billboardOverfishing: SceneObject;

  @input
  @allowUndefined
  @hint("Billboard copy group Thank you. Keep OFF in the editor; children stay ON. Shown with EndingVO.")
  billboardThankYou: SceneObject;

  @input
  @widget(new ColorWidget())
  @hint("Intro Frame plate color. Default is OceanX navy #0A2540.")
  introFrameColor: vec4 = new vec4(0.039, 0.145, 0.251, 1);

  @input
  @widget(new ColorWidget())
  @hint("Surface placement ring, dashed line, and glow. Default is OceanX navy #0A2540.")
  surfacePlacementColor: vec4 = new vec4(0.039, 0.145, 0.251, 1);

  @input
  @widget(new ColorWidget())
  @hint("ENTER button fill. Hover/press auto-lighten and darken. Default is OceanX cyan.")
  enterButtonColor: vec4 = new vec4(0, 0.706, 0.894, 1);
  @ui.group_end

  @ui.group_start("Audio")
  @input
  @hint("Welcome voice-over played during intro")
  welcomeAudio: AudioComponent;

  @input
  @hint("Instruction VO played after the user places the surface")
  placingAudio: AudioComponent;

  @input
  @hint("VO played once the required number of corals are placed")
  afterPlacingAudio: AudioComponent;

  @input
  @hint("VO played when the temperature slider appears")
  temperatureExplainAudio: AudioComponent;

  @input
  @allowUndefined
  @hint("Ending VO after OverfishingIssueSolveVO finishes. Do not stop()/pause().")
  endingAudio: AudioComponent;
  @ui.group_end

  private phase: ScenePhase = ScenePhase.Intro;
  private placementWatchEvent: SceneEvent | null = null;
  private placementAudioArmEvent: DelayedCallbackEvent | null = null;
  private afterPlacingVOPlayed = false;
  private experienceFinalized = false;
  private coralPickEnabled = false;
  private coralObjects: SceneObject[] = [];
  private introFrameTintApplied = false;
  private trashPhaseStarted = false;
  private overfishingPhaseStarted = false;
  private endingStarted = false;
  private headsetVolume = new Map<AudioComponent, number>();
  private fishFade = new AppearFade();
  private deviceDelay: DeviceDelay;
  private nextTargetingLockTime = 0;
  private targetingLockLogged = false;
  private placementHorizontal: Horizontal | null = null;
  private placementHints: HandHintsController | null = null;
  private lookLockTime = 0;
  private lookLockSent = false;
  private lookLockAnchor: vec3 | null = null;
  private lookBreakTime = 0;
  private lookBaseScale: vec3 | null = null;
  /** Smoothed 0–1 so the ring eases wider and eases back, instead of snapping. */
  private lookShown = 0;
  /** True only for the look-lock call. Pinch and tap hit the same methods and must not place. */
  private lookConfirmAllowed = false;
  private pinchConfirmBlocked = false;

  onAwake(): void {
    this.deviceDelay = new DeviceDelay(this);
    if (this.placingAudio) {
      this.placingAudio.setOnFinish(this.onPlacingVoFinished.bind(this));
    }
    if (this.afterPlacingAudio) {
      this.afterPlacingAudio.setOnFinish(this.onAfterPlacingVOFinished.bind(this));
    }
    if (this.temperatureExplainAudio) {
      this.temperatureExplainAudio.setOnFinish(
        this.onTemperatureExplainFinished.bind(this)
      );
    }
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
    this.createEvent("UpdateEvent").bind(() => {
      this.fishFade.tick(getDeltaTime());
      this.tickHandsOnlyTargeting();
    });
    this.createEvent("LateUpdateEvent").bind(() => {
      this.applyLookVisuals();
      if (this.phase === ScenePhase.Placing) {
        this.boostSurfacePlacementAudio();
      }
    });
    bindSnapCaptureMute(this);
  }

  private onStart(): void {
    this.keepHandsUnderWater();
    this.enableMixToSnapOnScene();
    this.cacheHeadsetVolumes();
    this.startOceanAmbient();
    this.collectCoralObjects();
    const lockWhenAwake = this.createEvent("DelayedCallbackEvent");
    lockWhenAwake.bind(() => {
      this.setCoralsInteractionLocked(true);
    });
    lockWhenAwake.reset(0);
    this.setClownfishVisible(false);
    this.setTemperatureSliderVisible(false);
    this.setObjectEnabled(this.trashScenarios, false);
    this.setObjectEnabled(this.overfishingScenarios, false);
    this.setBillboardBeat("none");
    if (this.temperatureWater) {
      this.temperatureWater.setOnSolveVoFinished(() => {
        this.setTemperatureSliderVisible(false);
        this.setBillboardBeat("none");
        this.runAfterDelay(1, () => this.beginTrashScenario());
      });
    }
    if (this.trashPickup) {
      this.trashPickup.setOnExplainFinished(
        this.onTrashExplainFinished.bind(this)
      );
      this.trashPickup.setOnSolveFinished(() => {
        this.setObjectEnabled(this.trashScenarios, false);
        this.setBillboardBeat("none");
        this.runAfterDelay(1, () => this.beginOverfishingScenario());
      });
    }
    if (this.overfishingPush) {
      this.overfishingPush.setOnExplainFinished(
        this.onOverfishingExplainFinished.bind(this)
      );
      this.overfishingPush.setOnSolveFinished(() => {
        this.setObjectEnabled(this.overfishingScenarios, false);
        this.setBillboardBeat("none");
        this.runAfterDelay(1, () => this.onOverfishingSolveFinished());
      });
    }
    if (this.endingAudio) {
      this.endingAudio.setOnFinish(this.onEndingVoFinished.bind(this));
    }
    this.applyIntroFrameTint();
    this.applyEnterButtonTint();
    this.lockHandsOnlyTargeting();
    this.enterIntro();
  }

  private collectCoralObjects(): void {
    this.coralObjects = [];
    if (!this.placedVisuals) {
      return;
    }
    // Reef pieces only (CoralSnapPiece). Tank decorations such as seaweed are skipped.
    this.collectCoralObjectsRecursive(this.placedVisuals);
  }

  private collectCoralObjectsRecursive(root: SceneObject): void {
    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = root.getChild(i);
      if (child.enabled && child.getComponent(CoralSnapPiece.getTypeName())) {
        this.coralObjects.push(child);
      }
      this.collectCoralObjectsRecursive(child);
    }
  }

  /** Wired from Continue button (CapsuleButton trigger up). */
  public onContinuePressed(): void {
    if (this.phase !== ScenePhase.Intro) {
      return;
    }

    if (this.introFrame) {
      this.introFrame.enabled = false;
    }

    this.muteAudio(this.welcomeAudio);
    this.startPlacementFlow();
  }

  /** Optional: wire from Reset button if you want SceneManager to track re-placement. */
  public onResetPressed(): void {
    if (!this.surfacePlacement) {
      return;
    }

    this.surfacePlacement.resetPlacement();
    this.phase = ScenePhase.Placing;
    this.resetLookLock();
    this.tintSurfacePlacementVisuals();
    this.startPlacementWatch();
  }

  private enterIntro(): void {
    this.phase = ScenePhase.Intro;

    // Respect IntroFrame's enabled state from the editor — do not force it on here.
    // (Previously this set enabled = true on every refresh, so unchecking it had no effect.)

    if (!this.introFrame || this.introFrame.enabled) {
      this.playWelcomeAfterDelay();
    }
  }

  /** Welcome VO was starting on the first frame. Give the user a moment to see the intro. */
  private playWelcomeAfterDelay(): void {
    this.deviceDelay.after(4, () => {
      if (this.phase !== ScenePhase.Intro) {
        return;
      }
      this.playAudio(this.welcomeAudio);
    });
  }

  /**
   * Frame's frosted-glass shader ignores backgroundColor, so overlay a solid
   * RoundedRectangle (first child so logo + Continue stay on top).
   */
  private applyIntroFrameTint(): void {
    if (!this.introFrame) {
      return;
    }

    const frame = this.introFrame.getComponent(Frame.getTypeName()) as Frame;
    if (!frame) {
      print("[SceneManager] IntroFrame has no Frame component to tint");
      return;
    }

    frame.autoShowHide = false;

    const apply = () => {
      frame.autoShowHide = false;
      frame.showVisual();
      this.tintFramePlate(frame);
    };

    if (frame.roundedRectangle) {
      apply();
    } else {
      frame.onInitialized.add(apply);
    }
  }

  private tintFramePlate(frame: Frame): void {
    if (this.introFrameTintApplied || !frame.roundedRectangle) {
      return;
    }
    this.introFrameTintApplied = true;

    const parent = frame.sceneObject;
    const existingChildren: SceneObject[] = [];
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      existingChildren.push(parent.getChild(i));
    }

    const plateObject = global.scene.createSceneObject("IntroFrameTint");
    plateObject.layer = parent.layer;
    plateObject.setParent(parent);
    plateObject.getTransform().setLocalPosition(new vec3(0, 0, 0.2));

    // Re-append original children so the tint plate paints first (behind them).
    for (let i = 0; i < existingChildren.length; i++) {
      existingChildren[i].setParent(parent);
    }

    const plate = plateObject.createComponent(
      RoundedRectangle.getTypeName()
    ) as RoundedRectangle;
    plate.cornerRadius = frame.roundedRectangle.cornerRadius;
    plate.size = frame.totalSize;
    plate.backgroundColor = this.introFrameColor;
    plate.initialize();
    plate.size = frame.totalSize;
    plate.backgroundColor = this.introFrameColor;
  }

  /**
   * UIKit Primary style is a packed gold gradient. Recolor the ENTER
   * CapsuleButton from the Inspector picker without unpacking the package.
   */
  private applyEnterButtonTint(): void {
    this.tintCapsuleButtonOnObject(this.enterButton);
  }

  private tintCapsuleButtonOnObject(buttonObject: SceneObject): void {
    if (!buttonObject) {
      return;
    }

    const button = buttonObject.getComponent(
      CapsuleButton.getTypeName()
    ) as CapsuleButton;
    if (!button) {
      print(`[SceneManager] ${buttonObject.name} has no CapsuleButton to tint`);
      return;
    }

    const apply = () => {
      this.tintEnterButtonVisual(button);
    };

    apply();
    button.onInitialized.add(() => {
      const delayed = this.createEvent(
        "DelayedCallbackEvent"
      ) as DelayedCallbackEvent;
      delayed.bind(apply);
      delayed.reset(0);
    });
  }

  private tintEnterButtonVisual(button: CapsuleButton): void {
    const visual = button.visual as RoundedRectangleVisual;
    if (!visual) {
      return;
    }

    const fill = this.enterButtonColor;
    const hover = this.scaleRgb(fill, 1.18);
    const press = this.scaleRgb(fill, 0.82);
    const rim = this.scaleRgb(fill, 1.28);

    const fillGrad = this.linearGradient(fill, fill);
    const hoverGrad = this.linearGradient(hover, rim);
    const pressGrad = this.linearGradient(press, fill);
    const borderGrad = this.linearGradient(rim, fill);
    const pressBorder = this.linearGradient(hover, rim);

    visual.defaultGradient = fillGrad;
    visual.hoveredGradient = hoverGrad;
    visual.triggeredGradient = pressGrad;
    visual.toggledDefaultGradient = pressGrad;
    visual.toggledHoveredGradient = hoverGrad;
    visual.toggledTriggeredGradient = pressGrad;
    visual.borderDefaultGradient = borderGrad;
    visual.borderHoveredGradient = borderGrad;
    visual.borderTriggeredGradient = pressBorder;
    visual.borderToggledDefaultGradient = pressBorder;
    visual.borderToggledHoveredGradient = pressBorder;
    visual.borderToggledTriggeredGradient = pressBorder;
  }

  private linearGradient(from: vec4, to: vec4): GradientParameters {
    return {
      enabled: true,
      type: "Linear",
      start: new vec2(-2, 1),
      end: new vec2(2, -1),
      stop0: { enabled: true, percent: 0, color: from },
      stop1: { enabled: true, percent: 0.5, color: from },
      stop2: { enabled: true, percent: 1, color: to },
    };
  }

  private scaleRgb(color: vec4, factor: number): vec4 {
    return new vec4(
      Math.min(1, color.x * factor),
      Math.min(1, color.y * factor),
      Math.min(1, color.z * factor),
      color.w
    );
  }

  /**
   * Packed SurfacePlacement assets are read-only. Recolor the spawned
   * HorizontalPlacement visuals at runtime (ring, dots, dashed line).
   */
  private tintSurfacePlacementVisuals(): void {
    const root = this.findSceneObjectByName("SurfacePlacementController");
    if (!root) {
      print("[SceneManager] SurfacePlacementController not found to tint");
      return;
    }
    this.tintPlacementTree(root, this.surfacePlacementColor);
  }

  private tintPlacementTree(obj: SceneObject, color: vec4): void {
    this.tintPlacementMesh(obj, color);

    const circle = obj.getComponent(CircleAnimation.getTypeName()) as CircleAnimation;
    if (circle) {
      circle.setCircleColor(color);
      this.hookCircleLoadingColor(circle, color);
    }

    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.tintPlacementTree(obj.getChild(i), color);
    }
  }

  private hookCircleLoadingColor(circle: CircleAnimation, color: vec4): void {
    const original = circle.setLoadingColor.bind(circle);
    circle.setLoadingColor = (isWhite: boolean) => {
      original(isWhite);
      if (!isWhite) {
        this.trySetPassColor(circle.getSceneObject(), "whiteColor", color);
      }
    };
  }

  private tintPlacementMesh(obj: SceneObject, color: vec4): void {
    const rmv = obj.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual;
    if (!rmv || !rmv.mainPass) {
      return;
    }

    const pass = rmv.mainPass;
    const keysToSet: string[] = [];
    for (let i = 0; i < PLACEMENT_COLOR_PROPS.length; i++) {
      const key = PLACEMENT_COLOR_PROPS[i];
      try {
        if (pass[key] !== undefined && pass[key] !== null) {
          keysToSet.push(key);
        }
      } catch (_error) {
        // Property is not on this shader.
      }
    }

    const forceTint =
      obj.name === "Arrow" || obj.name === "Dots" || obj.name === "PortalCircle";
    if (keysToSet.length === 0 && !forceTint) {
      return;
    }

    this.cloneMainMaterial(obj);
    const clonedPass = rmv.mainPass;
    const writeKeys = keysToSet.length > 0 ? keysToSet : PLACEMENT_COLOR_PROPS;
    for (let i = 0; i < writeKeys.length; i++) {
      this.trySetPassProperty(clonedPass, writeKeys[i], color);
    }
  }

  private cloneMainMaterial(obj: SceneObject): void {
    const rmv = obj.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual;
    if (!rmv || !rmv.mainMaterial) {
      return;
    }
    rmv.mainMaterial = rmv.mainMaterial.clone();
  }

  private trySetPassColor(obj: SceneObject, prop: string, color: vec4): void {
    const rmv = obj.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual;
    if (!rmv || !rmv.mainPass) {
      return;
    }
    this.trySetPassProperty(rmv.mainPass, prop, color);
  }

  private trySetPassProperty(pass: Pass, prop: string, color: vec4): void {
    try {
      if (pass[prop] === undefined) {
        return;
      }
      pass[prop] = color;
    } catch (error) {
      print(`[SceneManager] skip pass.${prop}: ${error}`);
    }
  }

  /**
   * HandVisual hides its render-order input and writes 9999 onto the mesh at awake.
   * Set 2 after that so the hand draws before the water.
   */
  private keepHandsUnderWater(): void {
    const names = [
      "RightHandMeshFull",
      "LeftHandMeshFull",
      "RightHandMeshIndexThumb",
      "LeftHandMeshIndexThumb",
    ];
    for (let i = 0; i < names.length; i++) {
      const mesh = this.findSceneObjectByName(names[i]);
      if (!mesh) {
        continue;
      }
      const visual = mesh.getComponent(
        "Component.RenderMeshVisual"
      ) as RenderMeshVisual;
      if (visual) {
        visual.renderOrder = HAND_RENDER_ORDER;
      }
    }
  }

  private findSceneObjectByName(name: string): SceneObject | null {
    const rootCount = global.scene.getRootObjectsCount();
    for (let i = 0; i < rootCount; i++) {
      const found = this.findNamedChild(global.scene.getRootObject(i), name);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private findNamedChild(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) {
      return obj;
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const found = this.findNamedChild(obj.getChild(i), name);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private startPlacementFlow(): void {
    this.phase = ScenePhase.Placing;

    if (this.surfacePlacement) {
      this.surfacePlacement.startPlacement();
      this.resetLookLock();
      this.tintSurfacePlacementVisuals();
      this.armSurfacePlacementAudioUntilPlaced();
    }

    this.startPlacementWatch();
  }

  private startPlacementWatch(): void {
    if (!this.placementWatchEvent) {
      this.placementWatchEvent = this.createEvent("UpdateEvent");
      this.placementWatchEvent.bind(this.onPlacementWatch.bind(this));
    }
    this.placementWatchEvent.enabled = true;
  }

  private onPlacementWatch(): void {
    if (this.phase !== ScenePhase.Placing) {
      return;
    }

    this.tickLookToPlace(getDeltaTime());

    if (!this.placedVisuals || !this.placedVisuals.enabled) {
      return;
    }

    this.finishPlacement();
  }

  private resetLookLock(): void {
    this.lookLockTime = 0;
    this.lookLockSent = false;
    this.lookLockAnchor = null;
    this.lookBreakTime = 0;
    this.lookBaseScale = null;
    this.lookShown = 0;
  }

  /**
   * The ring already follows the look. A steady look at one spot locks it.
   * Pinch and tap are ignored.
   */
  private tickLookToPlace(dt: number): void {
    const horizontal = this.getPlacementHorizontal();
    if (!horizontal || this.lookLockSent) {
      return;
    }

    if (this.placementHints) {
      this.placementHints.disableHint();
    }
    this.blockPlacementPinch(horizontal);

    const ring = this.placementRingPosition(horizontal);
    if (!ring) {
      return;
    }

    const jumped =
      this.lookLockAnchor !== null && this.movedPastLock(ring, this.lookLockAnchor);
    if (!this.lookLockAnchor || jumped) {
      this.lookBreakTime += dt;
      if (!this.lookLockAnchor || this.lookBreakTime >= LOOK_LOCK_BREAK_SECONDS) {
        this.lookLockAnchor = ring;
        this.lookLockTime = 0;
        this.lookBreakTime = 0;
      }
    } else {
      this.lookBreakTime = 0;
      this.lookLockTime += dt;
    }

    if (this.lookLockTime < LOOK_LOCK_SECONDS) {
      return;
    }

    this.lookConfirmAllowed = true;
    horizontal.onInteractionStart();
    horizontal.onInteractionEnd();
    this.lookConfirmAllowed = false;
    const stillPlacing = (
      horizontal as unknown as { isCalibrationRunning: boolean }
    ).isCalibrationRunning;
    if (stillPlacing) {
      this.lookLockTime = 0;
      this.lookLockAnchor = null;
      return;
    }
    this.lookLockSent = true;
    print("[SceneManager] placement locked by looking");
  }

  /**
   * The package confirms on any pinch-up, and again if the ring itself is pinched.
   * Only the look-lock call is allowed through.
   */
  private blockPlacementPinch(horizontal: Horizontal): void {
    const root = this.findSceneObjectByName("SurfacePlacementController");
    if (root) {
      this.disablePlacementInteractables(root);
    }
    const single = horizontal.getSceneObject().getComponent(
      SingleSurface.getTypeName()
    ) as SingleSurface;
    if (single && single.interactable) {
      single.interactable.enabled = false;
    }
    if (this.pinchConfirmBlocked) {
      return;
    }
    this.pinchConfirmBlocked = true;
    const gate = horizontal as Horizontal & {
      onInteractionStart: () => void;
      onInteractionEnd: () => void;
    };
    const start = gate.onInteractionStart.bind(horizontal);
    const end = gate.onInteractionEnd.bind(horizontal);
    gate.onInteractionStart = () => {
      if (!this.lookConfirmAllowed) {
        return;
      }
      start();
    };
    gate.onInteractionEnd = () => {
      if (!this.lookConfirmAllowed) {
        return;
      }
      end();
    };
  }

  private disablePlacementInteractables(obj: SceneObject): void {
    const interactable = obj.getComponent(
      Interactable.getTypeName()
    ) as Interactable;
    if (interactable) {
      interactable.enabled = false;
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.disablePlacementInteractables(obj.getChild(i));
    }
  }

  /** Runs after the placement package, so its labels and ring motion cannot cover this. */
  private applyLookVisuals(): void {
    if (this.phase !== ScenePhase.Placing || this.lookLockSent) {
      return;
    }
    const horizontal = this.placementHorizontal;
    if (!horizontal) {
      return;
    }
    if (horizontal.screenTextObj) {
      horizontal.screenTextObj.enabled = false;
    }
    this.setLookLabel(horizontal);
    const raw = Math.min(1, Math.max(0, this.lookLockTime / LOOK_LOCK_SECONDS));
    const target = raw * raw * (3 - 2 * raw);
    const follow = 1 - Math.exp(-4 * Math.max(getDeltaTime(), 0.001));
    this.lookShown += (target - this.lookShown) * follow;
    this.showLookGrow(horizontal, this.lookShown);
  }

  /** The floor ring eases wider while the 4 second hold is counting. */
  private showLookGrow(horizontal: Horizontal, progress: number): void {
    if (!horizontal.circleAnim) {
      return;
    }
    const icon = horizontal.circleAnim.getSceneObject();
    if (!icon) {
      return;
    }
    const transform = icon.getTransform();
    if (!this.lookBaseScale) {
      const scale = transform.getLocalScale();
      this.lookBaseScale = new vec3(scale.x, scale.y, scale.z);
    }
    const amount = Math.min(1, Math.max(0, progress));
    const grow = 1 + amount * 0.28;
    const base = this.lookBaseScale;
    transform.setLocalScale(new vec3(base.x * grow, base.y * grow, base.z * grow));
    const color = this.surfacePlacementColor;
    const accent = this.enterButtonColor;
    horizontal.circleAnim.setCircleColor(
      new vec4(
        color.x + (accent.x - color.x) * amount,
        color.y + (accent.y - color.y) * amount,
        color.z + (accent.z - color.z) * amount,
        1
      )
    );
  }

  private setLookLabel(horizontal: Horizontal): void {
    if (horizontal.confirmText) {
      horizontal.confirmText.text = "Look to Place";
    }
    const root = this.findSceneObjectByName("SurfacePlacementController");
    if (root) {
      this.replacePinchLabel(root);
    }
  }

  private replacePinchLabel(obj: SceneObject): void {
    const text = obj.getComponent("Component.Text") as Text;
    if (text && text.text !== "Look to Place") {
      text.text = "Look to Place";
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.replacePinchLabel(obj.getChild(i));
    }
  }

  private movedPastLock(a: vec3, b: vec3): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz > LOOK_LOCK_MOVE_CM * LOOK_LOCK_MOVE_CM;
  }

  private getPlacementHorizontal(): Horizontal | null {
    if (this.placementHorizontal) {
      return this.placementHorizontal;
    }
    const root = this.findSceneObjectByName("SurfacePlacementController");
    if (!root) {
      return null;
    }
    this.placementHorizontal = this.findHorizontal(root);
    this.placementHints = this.findHandHints(root);
    return this.placementHorizontal;
  }

  private placementRingPosition(horizontal: Horizontal): vec3 | null {
    if (!horizontal.circleAnim) {
      return null;
    }
    const icon = horizontal.circleAnim.getSceneObject();
    if (!icon || !icon.enabled) {
      return null;
    }
    return icon.getTransform().getWorldPosition();
  }

  private findHorizontal(obj: SceneObject): Horizontal | null {
    const component = obj.getComponent(Horizontal.getTypeName()) as Horizontal;
    if (component) {
      return component;
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const found = this.findHorizontal(obj.getChild(i));
      if (found) {
        return found;
      }
    }
    return null;
  }

  private findHandHints(obj: SceneObject): HandHintsController | null {
    const component = obj.getComponent(
      HandHintsController.getTypeName()
    ) as HandHintsController;
    if (component) {
      return component;
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const found = this.findHandHints(obj.getChild(i));
      if (found) {
        return found;
      }
    }
    return null;
  }

  private finishPlacement(): void {
    this.phase = ScenePhase.Placed;

    if (this.placementWatchEvent) {
      this.placementWatchEvent.enabled = false;
    }
    if (this.placementAudioArmEvent) {
      this.placementAudioArmEvent.enabled = false;
    }

    this.setCoralsInteractionLocked(true);
    this.playPlacingVoAfterSurfaceChime();
  }

  /**
   * CalibrateSnap starts ~0.5s before visuals enable. Play placing VO shortly
   * after; do not wait on muted welcome (volume 0 still reports isPlaying).
   */
  private playPlacingVoAfterSurfaceChime(): void {
    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      if (this.phase !== ScenePhase.Placed) {
        return;
      }
      if (!this.placingAudio) {
        this.onPlacingVoFinished();
        return;
      }
      this.showVoSubtitle(this.billboardPinchCoral);
      this.playAudio(this.placingAudio);
    });
    delay.reset(1);
  }

  /**
   * Called by CoralSnapManager when floor occupancy changes.
   * When all corals are on the tank: lock them first, then show fish and play VO.
   */
  public onCoralPlacementChanged(filledCount: number, totalSlots: number): void {
    if (totalSlots <= 0) {
      return;
    }

    if (filledCount < totalSlots) {
      if (this.trashPhaseStarted || this.overfishingPhaseStarted) {
        return;
      }
      const shouldResetTemperature =
        this.afterPlacingVOPlayed || this.experienceFinalized;

      this.afterPlacingVOPlayed = false;
      this.experienceFinalized = false;
      this.setClownfishVisible(false);
      this.setPlatformVisible(true);
      if (this.coralPickEnabled) {
        this.setCoralsInteractionLocked(false);
      }
      if (shouldResetTemperature) {
        this.muteAudio(this.afterPlacingAudio);
        this.muteAudio(this.temperatureExplainAudio);
        if (this.temperatureWater) {
          this.temperatureWater.resetTemperatureChallenge();
        }
        if (this.coralPickEnabled) {
          this.setBillboardBeat("coral");
        }
      }
      return;
    }

    if (this.afterPlacingVOPlayed) {
      return;
    }

    this.afterPlacingVOPlayed = true;
    this.coralPickEnabled = false;
    this.setCoralsInteractionLocked(true);
    this.setClownfishVisible(true);
    this.muteAudio(this.placingAudio);
    this.runAfterDelay(1, () => {
      if (!this.afterPlacingVOPlayed || this.experienceFinalized) {
        return;
      }
      this.playAudio(this.afterPlacingAudio);
    });
  }

  private onPlacingVoFinished(): void {
    if (this.phase !== ScenePhase.Placed || this.coralPickEnabled) {
      return;
    }
    this.coralPickEnabled = true;
    this.setCoralsInteractionLocked(false);
    this.showTaskCardAfterSubtitle("coral");
  }

  private onAfterPlacingVOFinished(): void {
    if (!this.afterPlacingVOPlayed || this.experienceFinalized) {
      return;
    }
    this.setPlatformVisible(false);
    this.setBillboardBeat("none");
    this.runAfterDelay(1, () => {
      if (!this.afterPlacingVOPlayed || this.experienceFinalized) {
        return;
      }
      this.finalizeExperience();
    });
  }

  private runAfterDelay(seconds: number, action: () => void): void {
    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(action);
    delay.reset(seconds);
  }

  private finalizeExperience(): void {
    this.experienceFinalized = true;
    this.setPlatformVisible(false);
    this.setCoralsInteractionLocked(true);
    this.setTemperatureSliderVisible(true);
    if (this.temperatureWater) {
      this.temperatureWater.applyHighDefault();
      this.temperatureWater.setSliderInputEnabled(false);
    }
    if (!this.temperatureExplainAudio) {
      this.setBillboardBeat("temperature");
      if (this.temperatureWater) {
        this.temperatureWater.setSliderInputEnabled(true);
      }
      return;
    }
    this.muteAudio(this.afterPlacingAudio);
    this.showVoSubtitle(this.billboardTemperature);
    this.playAudio(this.temperatureExplainAudio);
  }

  private onTemperatureExplainFinished(): void {
    if (!this.experienceFinalized || this.trashPhaseStarted || this.overfishingPhaseStarted) {
      return;
    }
    this.showTaskCardAfterSubtitle("temperature");
    if (this.temperatureWater) {
      this.temperatureWater.setSliderInputEnabled(true);
    }
  }

  private onTrashExplainFinished(): void {
    if (!this.trashPhaseStarted) {
      return;
    }
    this.showTaskCardAfterSubtitle("trash");
  }

  private beginOverfishingScenario(): void {
    if (this.overfishingPhaseStarted) {
      return;
    }
    this.overfishingPhaseStarted = true;
    this.muteAudio(this.temperatureExplainAudio);
    if (this.trashPickup) {
      this.trashPickup.muteSolveAudio();
    }
    this.setObjectEnabled(this.trashScenarios, false);
    this.setObjectEnabled(this.overfishingScenarios, true);
    this.applyDirectTargeting(this.overfishingScenarios);
    this.applyDirectTargeting(this.billboardOverfishing);
    this.showVoSubtitle(this.billboardOverfishing);
    if (this.overfishingPush) {
      this.overfishingPush.begin();
    } else {
      print("[SceneManager] overfishingPush is not assigned");
    }
  }

  private onOverfishingExplainFinished(): void {
    if (!this.overfishingPhaseStarted) {
      return;
    }
    this.showTaskCardAfterSubtitle("overfishing");
  }

  private onOverfishingSolveFinished(): void {
    this.endingStarted = true;
    this.setBillboardBeat("thanks");
    if (this.overfishingPush) {
      this.overfishingPush.muteSolveAudio();
    }
    if (!this.endingAudio) {
      print("[SceneManager] endingAudio is not assigned — drag EndingVO Audio onto SceneManager");
      return;
    }
    this.playAudio(this.endingAudio);
  }

  private onEndingVoFinished(): void {
    this.muteAudio(this.endingAudio);
  }

  /**
   * After temperature Solve VO: hide heat UI (already done), restore healthy
   * tank look, enable trash, lock pinch until TrashIssueExplain finishes.
   */
  private beginTrashScenario(): void {
    if (this.trashPhaseStarted) {
      return;
    }
    this.trashPhaseStarted = true;
    this.muteAudio(this.temperatureExplainAudio);
    if (this.temperatureWater) {
      this.temperatureWater.muteSolveAudio();
    }
    this.setTemperatureSliderVisible(false);
    if (this.temperatureWater) {
      this.temperatureWater.restoreHealthyTankLook();
    }
    this.setObjectEnabled(this.overfishingScenarios, false);
    this.setObjectEnabled(this.trashScenarios, true);
    this.showVoSubtitle(this.billboardTrash);
    if (this.trashPickup) {
      this.trashPickup.begin();
    } else {
      print("[SceneManager] trashPickup is not assigned");
    }
  }

  private setBillboardBeat(
    beat: "none" | "coral" | "temperature" | "trash" | "overfishing" | "thanks"
  ): void {
    this.showFullBillboard(this.billboardPinchCoral, beat === "coral");
    this.showFullBillboard(this.billboardTemperature, beat === "temperature");
    this.showFullBillboard(this.billboardTrash, beat === "trash");
    this.showFullBillboard(this.billboardOverfishing, beat === "overfishing");
    this.showFullBillboard(this.billboardThankYou, beat === "thanks");
  }

  /**
   * VO ends, subtitle stays 1 second, then a 1 second blank, then title and context.
   */
  private showTaskCardAfterSubtitle(
    beat: "coral" | "temperature" | "trash" | "overfishing"
  ): void {
    this.runAfterDelay(1, () => {
      this.setBillboardBeat("none");
      this.runAfterDelay(1, () => {
        if (beat === "coral" && this.experienceFinalized) {
          return;
        }
        if (
          beat === "temperature" &&
          (this.trashPhaseStarted || this.overfishingPhaseStarted)
        ) {
          return;
        }
        if (beat === "trash" && this.overfishingPhaseStarted) {
          return;
        }
        if (beat === "overfishing" && this.endingStarted) {
          return;
        }
        this.setBillboardBeat(beat);
      });
    });
  }

  /** Instruction card stays hidden. Only the _Subtitle line is on while the VO plays. */
  private showVoSubtitle(group: SceneObject): void {
    this.showFullBillboard(this.billboardPinchCoral, false);
    this.showFullBillboard(this.billboardTemperature, false);
    this.showFullBillboard(this.billboardTrash, false);
    this.showFullBillboard(this.billboardOverfishing, false);
    this.showFullBillboard(this.billboardThankYou, false);
    if (!group) {
      return;
    }
    group.enabled = true;
    const childCount = group.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = group.getChild(i);
      child.enabled = child.name.indexOf("_Subtitle") >= 0;
    }
  }

  private showFullBillboard(group: SceneObject, visible: boolean): void {
    if (!group) {
      return;
    }
    group.enabled = visible;
    if (!visible) {
      return;
    }
    const childCount = group.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = group.getChild(i);
      child.enabled = child.name.indexOf("_Subtitle") < 0;
    }
  }

  private setPlatformVisible(visible: boolean): void {
    if (this.platform) {
      this.platform.enabled = visible;
    }
  }

  /**
   * UIKit frames set TargetingMode.All when they initialize, which turns the
   * far ray back on. ENTER is poke. Everything else stays close-hand Direct.
   */
  private tickHandsOnlyTargeting(): void {
    const now = getTime();
    if (now < this.nextTargetingLockTime) {
      return;
    }
    this.nextTargetingLockTime = now + 0.25;
    this.lockHandsOnlyTargeting();
  }

  private lockHandsOnlyTargeting(): void {
    const rootCount = global.scene.getRootObjectsCount();
    for (let i = 0; i < rootCount; i++) {
      this.lockTargetingOnObject(global.scene.getRootObject(i), false);
    }
    if (!this.targetingLockLogged) {
      this.targetingLockLogged = true;
      print("[SceneManager] ENTER is poke; the rest is hands only");
    }
  }

  private lockTargetingOnObject(obj: SceneObject, underEnter: boolean): void {
    const isEnter =
      underEnter || (!!this.enterButton && obj.isSame(this.enterButton));
    const interactable = obj.getComponent(
      Interactable.getTypeName()
    ) as Interactable;
    if (interactable) {
      // 4 = Poke. 1 = Direct. Neither includes the far ray.
      interactable.targetingMode = isEnter ? 4 : 1;
      interactable.targetingVisual = 0;
    }
    const plane = obj.getComponent(
      InteractionPlane.getTypeName()
    ) as InteractionPlane;
    if (plane) {
      plane.targetingVisual = 0;
    }

    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.lockTargetingOnObject(obj.getChild(i), isEnter);
    }
  }

  /** Match reef coral pinch: close-hand Direct only, no ray. */
  private applyDirectTargeting(root: SceneObject): void {
    if (!root) {
      return;
    }

    const interactable = root.getComponent(
      Interactable.getTypeName()
    ) as Interactable;
    if (interactable) {
      interactable.targetingMode = 1;
      interactable.targetingVisual = 0;
    }

    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.applyDirectTargeting(root.getChild(i));
    }
  }

  private setTemperatureSliderVisible(visible: boolean): void {
    const group =
      this.temperatureScenarios ||
      (this.temperatureSlider ? this.temperatureSlider.getParent() : null);
    this.setObjectEnabled(group, visible);
    this.setObjectEnabled(this.temperatureSlider, visible);
    this.setObjectEnabled(this.temperatureFactsFrame, visible);
    this.setObjectEnabled(this.temperatureKnowledgeFrame, visible);
  }

  private setObjectEnabled(obj: SceneObject, visible: boolean): void {
    if (!obj) {
      return;
    }
    obj.enabled = visible;
  }

  private setCoralsInteractionLocked(locked: boolean): void {
    for (let i = 0; i < this.coralObjects.length; i++) {
      this.setCoralInteractionLocked(this.coralObjects[i], locked);
    }
  }

  private setCoralInteractionLocked(coral: SceneObject, locked: boolean): void {
    const piece = coral.getComponent(
      CoralSnapPiece.getTypeName()
    ) as CoralSnapPiece;
    if (
      piece &&
      typeof piece.lockInteraction === "function" &&
      typeof piece.unlockInteraction === "function"
    ) {
      if (locked) {
        piece.lockInteraction();
      } else {
        piece.unlockInteraction();
      }
      return;
    }

    const manipulation = coral.getComponent(
      InteractableManipulation.getTypeName()
    ) as InteractableManipulation;
    const interactable = coral.getComponent(
      Interactable.getTypeName()
    ) as Interactable;

    if (manipulation) {
      manipulation.enabled = !locked;
    }
    if (interactable) {
      interactable.enabled = !locked;
    }
  }

  private setClownfishVisible(visible: boolean): void {
    if (!this.clownfishCircling) {
      return;
    }
    if (!visible) {
      this.clownfishCircling.enabled = false;
      return;
    }
    const wasHidden = !this.clownfishCircling.enabled;
    this.clownfishCircling.enabled = true;
    if (wasHidden) {
      this.fishFade.play([this.clownfishCircling]);
    }
  }

  private startOceanAmbient(): void {
    const owner = this.findSceneObjectByName(OCEAN_AMBIENT_NAME);
    if (!owner) {
      print("[SceneManager] Ocean_Background_SFX not found");
      return;
    }
    owner.enabled = true;
    const audio = owner.getComponent(
      "Component.AudioComponent"
    ) as AudioComponent;
    if (!audio) {
      print("[SceneManager] Ocean_Background_SFX has no AudioComponent");
      return;
    }
    audio.enabled = true;
    applyAmbientMix(audio, OCEAN_AMBIENT_VOLUME);
    audio.playbackMode = Audio.PlaybackMode.LowPower;
    if (!audio.isPlaying()) {
      audio.play(-1);
    }
  }

  private playAudio(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    this.muteOtherVoiceovers(audio);
    audio.enabled = true;
    const owner = audio.getSceneObject();
    if (owner) {
      owner.enabled = true;
    }
    applyPlayMix(audio, 1);
    audio.playbackMode = Audio.PlaybackMode.LowLatency;
    playCapturedVoice(audio, 1);
  }

  /**
   * Mute without stop()/pause() — those duck the Specs mixer.
   * recordingVolume=0 drops Mix-to-Snap; volume=0 silences the headset.
   */
  private muteAudio(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    applyMuteMix(audio);
    audio.enabled = false;
  }

  private muteOtherVoiceovers(keep: AudioComponent): void {
    const clips = [
      this.welcomeAudio,
      this.placingAudio,
      this.afterPlacingAudio,
      this.temperatureExplainAudio,
      this.endingAudio,
    ];
    for (let i = 0; i < clips.length; i++) {
      if (clips[i] && clips[i] !== keep) {
        this.muteAudio(clips[i]);
      }
    }
  }

  private cacheHeadsetVolumes(): void {
    this.cacheHeadsetVolume(this.welcomeAudio);
    this.cacheHeadsetVolume(this.placingAudio);
    this.cacheHeadsetVolume(this.afterPlacingAudio);
    this.cacheHeadsetVolume(this.temperatureExplainAudio);
    this.cacheHeadsetVolume(this.endingAudio);
  }

  private cacheHeadsetVolume(audio: AudioComponent): void {
    if (!audio || this.headsetVolume.has(audio)) {
      return;
    }
    const volume = audio.volume;
    this.headsetVolume.set(audio, volume > 0 ? volume : 0.5);
  }

  private playbackVolume(audio: AudioComponent): number {
    this.cacheHeadsetVolume(audio);
    const volume = this.headsetVolume.get(audio);
    return volume !== undefined ? volume : 0.5;
  }

  /**
   * Mix-to-Snap ignores the mic only when every AudioComponent opts in.
   */
  private enableMixToSnapOnScene(): void {
    const scene = global.scene as unknown as {
      getRootObjectsCount?: () => number;
      getRootObject?: (index: number) => SceneObject;
    };
    if (scene.getRootObjectsCount && scene.getRootObject) {
      const count = scene.getRootObjectsCount();
      for (let i = 0; i < count; i++) {
        this.enableMixToSnapTree(scene.getRootObject(i));
      }
      return;
    }
    let root = this.getSceneObject();
    let parent = root.getParent();
    while (parent) {
      root = parent;
      parent = root.getParent();
    }
    this.enableMixToSnapTree(root);
  }

  private enableMixToSnapTree(obj: SceneObject): void {
    if (!obj) {
      return;
    }
    const audio = obj.getComponent(
      "Component.AudioComponent"
    ) as AudioComponent;
    if (audio) {
      enableMixToSnap(audio);
    }
    const count = obj.getChildrenCount();
    for (let i = 0; i < count; i++) {
      this.enableMixToSnapTree(obj.getChild(i));
    }
  }

  /**
   * CalibrateSnap plays when the surface snap completes, on a runtime
   * AudioComponent. Keep that clip on the SFX mix until then so VO speaker-mute
   * cannot leave it at volume 0.
   */
  private armSurfacePlacementAudioUntilPlaced(): void {
    this.boostSurfacePlacementAudio();
    if (this.phase !== ScenePhase.Placing) {
      return;
    }
    if (!this.placementAudioArmEvent) {
      this.placementAudioArmEvent = this.createEvent(
        "DelayedCallbackEvent"
      ) as DelayedCallbackEvent;
      this.placementAudioArmEvent.bind(() => {
        this.armSurfacePlacementAudioUntilPlaced();
      });
    }
    this.placementAudioArmEvent.enabled = true;
    this.placementAudioArmEvent.reset(0.2);
  }

  /**
   * Surface Placement plays CalibrateSnap on a runtime AudioComponent parented
   * to SurfacePlacementController.
   */
  private boostSurfacePlacementAudio(): void {
    const root = this.findSceneObjectByName("SurfacePlacementController");
    if (!root) {
      return;
    }
    this.armPlacementSnap(root);
  }

  /**
   * The package calls play() itself. Keep the speaker level up until that
   * play, so the chime enters the recording, then silence the speakers.
   */
  private armPlacementSnap(obj: SceneObject): void {
    const audio = obj.getComponent(
      "Component.AudioComponent"
    ) as AudioComponent;
    if (audio) {
      audio.enabled = true;
      const owner = audio.getSceneObject();
      if (owner) {
        owner.enabled = true;
      }
      audio.playbackMode = Audio.PlaybackMode.LowLatency;
      const mix = audio as AudioComponent & {
        mixToSnap: boolean;
        recordingVolume: number;
      };
      mix.mixToSnap = true;
      mix.recordingVolume = 1;
      if (audio.isPlaying() && isSnapRecording()) {
        mix.volume = 0;
      } else if (!audio.isPlaying()) {
        mix.volume = 1;
      }
    }
    const childCount = obj.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.armPlacementSnap(obj.getChild(i));
    }
  }

}
