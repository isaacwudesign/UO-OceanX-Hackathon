/**
 * Temperature challenge: slider, solve VO, and clownfish reveal.
 * Tints TankGlass on Tank_Body. Ocean_Water_Wave is left alone (wave shader).
 */
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { GradientParameters } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle";
import { RoundedRectangleVisual } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import { ClownfishOrbit } from "./ClownfishOrbit";
import { applyMuteMix, applyPlayMix, applySfxMix } from "./SnapAudio";

const TARGET_TEMPERATURE = 0.5;

const COLOR_COLD = new vec3(0.658824, 0.921569, 0.956863); // #a8ebf4
const COLOR_MIDDLE = new vec3(0.047059, 0.717647, 1.0); // #0CB7FF
const COLOR_HIGH = new vec3(0.596078, 0.8, 0.4); // #98cc66

const DEFAULT_SLIDER_VALUE = 1;
const SLIDER_NAVY = new vec4(0.039, 0.145, 0.251, 1); // #0A2540
const SLIDER_CYAN = new vec4(0, 0.706, 0.894, 1); // #00B4E4
const GLASS_DESATURATE = 0.28;
const DEFAULT_GLASS_ALPHA = 0.22;

/** Pale dusty mix — heat-stressed coral reads washed, not vivid. */
const CORAL_BLEACH = new vec3(0.55, 0.52, 0.46);
const CORAL_BLEACH_AMOUNT = 0.92;
const STRESSED_MOTION_SCALE = 0.22;
interface CoralTint {
  visual: RenderMeshVisual;
  material: Material;
  origRgb: vec3;
  alpha: number;
  origAlbedo: Texture | null;
}

@component
export class TemperatureWaterController extends BaseScriptComponent {
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Tank_Body RenderMeshVisual (TankGlass). Do not assign Ocean_Water_Wave.")
  tankGlass: RenderMeshVisual;

  @input
  @allowUndefined
  @hint("Optional: scene object that has the UIKit Slider")
  temperatureSliderObject: SceneObject;

  @input
  @hint("Clownfish orbit group shown again when temperature is corrected")
  clownfishCircling: SceneObject;

  @input
  @allowUndefined
  @hint("Optional: slider root hidden after the solve VO finishes")
  temperatureSlider: SceneObject;

  @input
  @allowUndefined
  @hint("Facts panel shown and hidden with the temperature slider")
  temperatureFactsFrame: SceneObject;

  @input
  @allowUndefined
  @hint("Knowledge panel shown and hidden with the temperature slider")
  temperatureKnowledgeFrame: SceneObject;

  @input
  @allowUndefined
  @hint("Coral_Reefs group under Coral_Platform. All reef meshes under it bleach with the slider.")
  coralReefs: SceneObject;
  @ui.group_end

  @ui.group_start("Bleached Coral Albedo")
  @input
  @allowUndefined
  @hint("Desaturated Image_0 (Corals_2_7_10_12 albedo)")
  bleachedImage0: Texture;

  @input
  @allowUndefined
  @hint("Desaturated Image_3 (Coral_13_15_16 albedo)")
  bleachedImage3: Texture;

  @input
  @allowUndefined
  @hint("Desaturated Image_4 (Corals_1_5_8_9 albedo)")
  bleachedImage4: Texture;
  @ui.group_end

  @ui.group_start("Correct Temperature Feedback")
  @input
  @allowUndefined
  @hint("SFX played when the slider reaches the middle (correct) range")
  welldoneSfx: AudioComponent;

  @input
  @allowUndefined
  @hint("WelldoneSFX.mp3 assigned onto welldoneSfx at runtime if the Audio slot is empty.")
  welldoneSfxTrack: AudioTrackAsset;

  @input
  @hint("VO played immediately after WelldoneSFX finishes")
  temperatureSolveVo: AudioComponent;

  @input
  @widget(new SliderWidget(0.05, 0.25, 0.01))
  @hint("How close to center (0.5) counts as correct, e.g. 0.15 = 0.35–0.65")
  middleTolerance: number = 0.15;
  @ui.group_end

  private tankGlassMaterial: Material | null = null;
  private glassAlpha = DEFAULT_GLASS_ALPHA;
  private coralTints: CoralTint[] = [];
  private coralsReady = false;
  private sliderBound = false;
  private sliderDirectBound = false;
  private temperaturePhaseActive = false;
  private temperatureSolved = false;
  private welldoneSfxPlaying = false;
  private temperatureSolveVoPlaying = false;
  private sliderInputEnabled = false;
  private explainVoFinished = false;
  private onSolveVoFinishedCallback: (() => void) | null = null;
  private onTemperatureSolvedCallback: (() => void) | null = null;
  private headsetVolume = new Map<AudioComponent, number>();

  onAwake() {
    this.setupTankGlassMaterial();
    this.setupCoralMaterials();
    this.configureVoiceoverAudio(this.temperatureSolveVo);
    this.applyWelldoneTrack();

    if (this.welldoneSfx) {
      this.configureVoiceoverAudio(this.welldoneSfx);
      this.welldoneSfx.setOnFinish(this.onWelldoneSfxFinished.bind(this));
    }

    if (this.temperatureSolveVo) {
      this.temperatureSolveVo.setOnFinish(
        this.onTemperatureSolveVoFinished.bind(this)
      );
    }

    this.createEvent("OnStartEvent").bind(() => {
      this.cacheHeadsetVolume(this.welldoneSfx);
      this.cacheHeadsetVolume(this.temperatureSolveVo);
      this.setupTankGlassMaterial();
      this.setupCoralMaterials();
      this.bindSliderIfNeeded();
    });
  }

  /**
   * Call when the temperature UI is revealed so the slider starts at High (H)
   * and the aquarium shows the warm/green tint first.
   */
  public applyHighDefault(): void {
    this.temperaturePhaseActive = true;
    this.temperatureSolved = false;
    this.setSliderInputEnabled(false);
    this.setupTankGlassMaterial();
    this.setupCoralMaterials();
    this.bindSliderIfNeeded();
    this.pushHighDefault();

    // Slider initializes on OnStart after the panel is enabled. Push Hot again
    // so init cannot leave the knob/glass on Cold.
    const delayed = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
    delayed.bind(() => {
      this.setupTankGlassMaterial();
      this.setupCoralMaterials();
      this.bindSliderIfNeeded();
      this.pushHighDefault();
      this.applyDirectTargetingToSlider();
      this.applyOceanXSliderTint();
    });
    delayed.reset(0);
  }

  private pushHighDefault(): void {
    const slider = this.getSlider();
    if (slider) {
      slider.currentValue = DEFAULT_SLIDER_VALUE;
    }
    this.applySliderValue(DEFAULT_SLIDER_VALUE);
  }

  /** Reset when leaving the post-placement / temperature flow (e.g. coral removed). */
  public resetTemperatureChallenge(): void {
    this.safeStopIfPlaying(this.welldoneSfx, "welldoneSfx");
    this.safeStopIfPlaying(this.temperatureSolveVo, "temperatureSolveVo");
    this.temperaturePhaseActive = false;
    this.temperatureSolved = false;
    this.welldoneSfxPlaying = false;
    this.temperatureSolveVoPlaying = false;
    this.setSliderInputEnabled(false);
    this.setTemperatureSliderVisible(false);
    this.applyCoralStress(TARGET_TEMPERATURE);
    this.setFishMotionScale(1);
  }

  private bindSliderIfNeeded(): void {
    if (this.sliderBound) {
      return;
    }

    const slider = this.getSlider();
    if (!slider || !slider.onValueChange) {
      return;
    }

    slider.onValueChange.add((value: number) => {
      this.onSliderValueChanged(value);
    });

    if (slider.onFinished) {
      slider.onFinished.add(() => {
        this.checkMiddleSolution(slider.currentValue);
      });
    }

    this.sliderBound = true;
    this.applyDirectTargetingToSlider();
    this.applyOceanXSliderTint();
    this.applySliderInputLock();
  }

  private ignoringLockedSlider = false;

  private onSliderValueChanged(value: number): void {
    if (this.ignoringLockedSlider) {
      return;
    }
    if (!this.sliderInputEnabled) {
      this.ignoringLockedSlider = true;
      this.pushHighDefault();
      this.ignoringLockedSlider = false;
      return;
    }
    this.applySliderValue(value);
    this.checkMiddleSolution(value);
  }

  private checkMiddleSolution(value: number): void {
    if (
      !this.explainVoFinished ||
      !this.sliderInputEnabled ||
      !this.temperaturePhaseActive ||
      this.temperatureSolved
    ) {
      return;
    }

    if (this.isMiddleRange(value)) {
      this.playTemperatureSolvedSequence();
    }
  }

  private isMiddleRange(value: number): boolean {
    return Math.abs(value - TARGET_TEMPERATURE) <= this.middleTolerance;
  }

  private playTemperatureSolvedSequence(): void {
    if (!this.explainVoFinished || this.temperatureSolved) {
      return;
    }
    this.temperatureSolved = true;
    this.setClownfishVisible(true);
    if (this.onTemperatureSolvedCallback) {
      this.onTemperatureSolvedCallback();
    }
    this.safeStopIfPlaying(this.temperatureSolveVo, "temperatureSolveVo");

    if (this.welldoneSfx && this.hasValidAudioTrack(this.welldoneSfx)) {
      this.playAudio(this.welldoneSfx, "welldoneSfx");
      return;
    }

    this.playAudio(this.temperatureSolveVo, "temperatureSolveVo");
  }

  private onWelldoneSfxFinished(): void {
    if (!this.temperatureSolved) {
      return;
    }
    this.welldoneSfxPlaying = false;
    this.muteClip(this.welldoneSfx);
    this.playAudio(this.temperatureSolveVo, "temperatureSolveVo");
  }

  private onTemperatureSolveVoFinished(): void {
    if (!this.temperatureSolved) {
      return;
    }
    this.temperatureSolveVoPlaying = false;
    this.muteClip(this.temperatureSolveVo);
    this.setTemperatureSliderVisible(false);
    this.restoreHealthyTankLook();
    if (this.onSolveVoFinishedCallback) {
      this.onSolveVoFinishedCallback();
    }
  }

  /** SceneManager binds trash start here so TWC does not import it. */
  public setOnSolveVoFinished(callback: () => void): void {
    this.onSolveVoFinishedCallback = callback;
  }

  /** Drop Mix-to-Snap tails before the next beat VO. */
  public muteSolveAudio(): void {
    this.muteClip(this.welldoneSfx);
    this.muteClip(this.temperatureSolveVo);
    this.welldoneSfxPlaying = false;
    this.temperatureSolveVoPlaying = false;
  }

  /** Fires when the slider lands in range, before well-done / Solve VO. */
  public setOnTemperatureSolved(callback: () => void): void {
    this.onTemperatureSolvedCallback = callback;
  }

  /**
   * Restore balanced water/coral tint without unlocking the reef or stopping audio.
   */
  public restoreHealthyTankLook(): void {
    this.temperaturePhaseActive = false;
    this.setSliderInputEnabled(false);
    this.applySliderValue(TARGET_TEMPERATURE);
    this.setFishMotionScale(1);
  }

  private hasValidAudioTrack(audio: AudioComponent): boolean {
    if (!audio || !audio.audioTrack) {
      return false;
    }
    return !isNull(audio.audioTrack);
  }

  private getSlider(): Slider | null {
    if (!this.temperatureSliderObject) {
      return null;
    }

    return this.temperatureSliderObject.getComponent(
      Slider.getTypeName()
    ) as Slider;
  }

  /** Match reef coral pinch: close-hand Direct only, no ray. */
  private applyDirectTargetingToSlider(): void {
    if (this.temperatureSlider) {
      this.applyDirectTargeting(this.temperatureSlider);
    }
    if (this.temperatureSliderObject) {
      this.applyDirectTargeting(this.temperatureSliderObject);
    }

    const slider = this.getSlider();
    if (!this.sliderDirectBound && slider && slider.onInitialized) {
      this.sliderDirectBound = true;
      slider.onInitialized.add(() => {
        if (this.temperatureSlider) {
          this.applyDirectTargeting(this.temperatureSlider);
        }
        if (this.temperatureSliderObject) {
          this.applyDirectTargeting(this.temperatureSliderObject);
        }
        this.applyOceanXSliderTint();
        this.applySliderInputLock();
      });
    }
    this.applyOceanXSliderTint();
    this.applySliderInputLock();
  }

  /** Locked until TempatureIssueExplain finishes so Solve VO cannot overlap it. */
  public setSliderInputEnabled(enabled: boolean): void {
    this.sliderInputEnabled = enabled;
    this.explainVoFinished = enabled;
    this.applySliderInputLock();
  }

  private applySliderInputLock(): void {
    const slider = this.getSlider();
    if (slider) {
      const inactiveSlider = slider as Slider & {inactive?: boolean};
      inactiveSlider.inactive = !this.sliderInputEnabled;
    }
    if (this.temperatureSlider) {
      this.setInteractableEnabled(this.temperatureSlider, this.sliderInputEnabled);
    }
    if (this.temperatureSliderObject) {
      this.setInteractableEnabled(
        this.temperatureSliderObject,
        this.sliderInputEnabled
      );
    }
  }

  private setInteractableEnabled(root: SceneObject, enabled: boolean): void {
    const interactable = root.getComponent(
      Interactable.getTypeName()
    ) as Interactable;
    if (interactable) {
      interactable.enabled = enabled;
    }
    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.setInteractableEnabled(root.getChild(i), enabled);
    }
  }
  private applyOceanXSliderTint(): void {
    const slider = this.getSlider();
    if (!slider) {
      return;
    }

    const cyanHover = this.scaleRgb(SLIDER_CYAN, 1.18);
    const cyanPress = this.scaleRgb(SLIDER_CYAN, 0.82);
    const trackGrad = this.linearGradient(SLIDER_NAVY, SLIDER_NAVY);
    const fillGrad = this.linearGradient(SLIDER_CYAN, cyanHover);
    const fillHoverGrad = this.linearGradient(cyanHover, SLIDER_CYAN);
    const knobGrad = this.linearGradient(SLIDER_CYAN, SLIDER_CYAN);
    const knobHoverGrad = this.linearGradient(cyanHover, SLIDER_CYAN);
    const knobPressGrad = this.linearGradient(cyanPress, SLIDER_CYAN);

    this.tintSliderVisual(slider.visual as RoundedRectangleVisual, trackGrad, trackGrad, trackGrad);
    this.tintSliderVisual(
      slider.trackFillVisual as RoundedRectangleVisual,
      fillGrad,
      fillHoverGrad,
      fillGrad
    );
    this.tintSliderVisual(
      slider.knobVisual as RoundedRectangleVisual,
      knobGrad,
      knobHoverGrad,
      knobPressGrad
    );
  }

  private tintSliderVisual(
    visual: RoundedRectangleVisual,
    defaultGrad: GradientParameters,
    hoverGrad: GradientParameters,
    pressGrad: GradientParameters
  ): void {
    if (!visual) {
      return;
    }
    visual.defaultBaseType = "Gradient";
    visual.hoveredBaseType = "Gradient";
    visual.triggeredBaseType = "Gradient";
    visual.defaultGradient = defaultGrad;
    visual.hoveredGradient = hoverGrad;
    visual.triggeredGradient = pressGrad;
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

  private applyDirectTargeting(root: SceneObject): void {
    if (!root) {
      return;
    }

    const interactable = root.getComponent(
      Interactable.getTypeName()
    ) as Interactable;
    if (interactable) {
      interactable.targetingMode = 1;
    }

    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.applyDirectTargeting(root.getChild(i));
    }
  }

  private setupTankGlassMaterial(): void {
    if (this.tankGlassMaterial) {
      return;
    }
    if (!this.tankGlass || !this.tankGlass.mainMaterial) {
      return;
    }

    this.tankGlassMaterial = this.tankGlass.mainMaterial.clone();
    this.tankGlass.mainMaterial = this.tankGlassMaterial;

    const existing = this.tankGlassMaterial.mainPass.baseColor;
    if (existing && existing.w > 0.01) {
      this.glassAlpha = existing.w;
    }
  }

  private setupCoralMaterials(): void {
    if (this.coralsReady || !this.coralReefs) {
      return;
    }

    const visuals: RenderMeshVisual[] = [];
    this.collectRenderMeshVisuals(this.coralReefs, visuals);

    for (let i = 0; i < visuals.length; i++) {
      const visual = visuals[i];
      if (!visual.mainMaterial) {
        continue;
      }

      const material = visual.mainMaterial.clone();
      visual.clearMaterials();
      visual.addMaterial(material);

      const pass = material.mainPass;
      const existing = this.readPassColor(pass);
      this.coralTints.push({
        visual: visual,
        material: material,
        origRgb: new vec3(existing.x, existing.y, existing.z),
        alpha: existing.w,
        origAlbedo: this.readAlbedoTexture(pass),
      });
    }

    this.coralsReady = true;
    let albedoCount = 0;
    for (let i = 0; i < this.coralTints.length; i++) {
      if (this.coralTints[i].origAlbedo) {
        albedoCount += 1;
      }
    }
    print(
      `[TemperatureWater] cloned ${this.coralTints.length} reef materials, ${albedoCount} with albedo maps`
    );
  }

  private collectRenderMeshVisuals(
    root: SceneObject,
    out: RenderMeshVisual[]
  ): void {
    const visual = root.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual;
    if (visual) {
      out.push(visual);
    }

    const childCount = root.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      this.collectRenderMeshVisuals(root.getChild(i), out);
    }
  }

  private applySliderValue(normalizedValue: number): void {
    const t =
      normalizedValue < 0 ? 0 : normalizedValue > 1 ? 1 : normalizedValue;

    if (this.tankGlassMaterial) {
      this.applyGlassTint(this.desaturate(this.temperatureToColor(t)));
    }

    this.applyCoralStress(
      this.temperaturePhaseActive ? t : TARGET_TEMPERATURE
    );

    const stress = this.temperaturePhaseActive
      ? Math.abs(t - TARGET_TEMPERATURE) * 2
      : 0;
    this.setFishMotionScale(
      1 - stress * (1 - STRESSED_MOTION_SCALE)
    );
  }

  private applyCoralStress(sliderT: number): void {
    if (!this.coralsReady) {
      this.setupCoralMaterials();
    }

    const stress = Math.abs(sliderT - TARGET_TEMPERATURE) * 2;
    const mix = stress * CORAL_BLEACH_AMOUNT;

    for (let i = 0; i < this.coralTints.length; i++) {
      const tint = this.coralTints[i];
      const rgb = vec3.lerp(tint.origRgb, CORAL_BLEACH, mix);
      const pass = tint.material.mainPass;
      this.writeCoralColor(pass, rgb, tint.alpha);
      this.writeCoralAlbedo(pass, tint, mix);
      tint.visual.mainMaterial = tint.material;
    }
  }

  private readPassColor(pass: Pass): vec4 {
    const keys = ["baseColor", "mainColor", "baseColorFactor", "Port_Albedo_N405"];
    for (let i = 0; i < keys.length; i++) {
      try {
        const value = pass[keys[i]];
        if (value && value.x !== undefined) {
          const alpha = value.w !== undefined ? value.w : 1;
          return new vec4(value.x, value.y, value.z, alpha);
        }
      } catch (_error) {
        // Property is not on this shader.
      }
    }
    return new vec4(1, 1, 1, 1);
  }

  private readAlbedoTexture(pass: Pass): Texture | null {
    try {
      const tex = pass.baseColorTexture as Texture;
      if (tex) {
        return tex;
      }
    } catch (_error) {
      // Untextured PBR materials have no albedo map.
    }
    return null;
  }

  private writeCoralColor(pass: Pass, rgb: vec3, alpha: number): void {
    const color4 = new vec4(rgb.x, rgb.y, rgb.z, alpha);
    const color3 = new vec3(rgb.x, rgb.y, rgb.z);
    // glTF coral graphs tint the texture with Port_Albedo / baseColorFactor.
    // Untextured PBR uses baseColor as the actual albedo (no texture).
    this.trySetPassValue(pass, "Port_Albedo_N405", color3);
    this.trySetPassValue(pass, "baseColorFactor", color4);
    this.trySetPassValue(pass, "baseColor", color4);
    this.trySetPassValue(pass, "mainColor", color4);
  }

  private writeCoralAlbedo(pass: Pass, tint: CoralTint, mix: number): void {
    if (!tint.origAlbedo) {
      return;
    }
    const bleached = this.getBleachedAlbedo(tint.origAlbedo);
    const useBleached = mix > 0.28 && bleached;
    this.trySetPassValue(
      pass,
      "baseColorTexture",
      useBleached ? bleached : tint.origAlbedo
    );
  }

  private getBleachedAlbedo(orig: Texture): Texture | null {
    const name = orig.name;
    if (name === "Image_0") {
      return this.bleachedImage0;
    }
    if (name === "Image_3") {
      return this.bleachedImage3;
    }
    if (name === "Image_4") {
      return this.bleachedImage4;
    }
    return null;
  }

  private trySetPassValue(pass: Pass, key: string, value: unknown): void {
    try {
      pass[key] = value;
    } catch (_error) {
      // Property is not on this shader.
    }
  }

  private applyGlassTint(rgb: vec3): void {
    if (!this.tankGlassMaterial) {
      return;
    }

    const pass = this.tankGlassMaterial.mainPass;
    pass.baseColor = new vec4(rgb.x, rgb.y, rgb.z, this.glassAlpha);
    if (this.tankGlass) {
      this.tankGlass.mainMaterial = this.tankGlassMaterial;
    }
  }

  private desaturate(rgb: vec3): vec3 {
    const grey = rgb.x * 0.3 + rgb.y * 0.59 + rgb.z * 0.11;
    return vec3.lerp(rgb, new vec3(grey, grey, grey), GLASS_DESATURATE);
  }

  private temperatureToColor(t: number): vec3 {
    if (t <= 0.5) {
      return vec3.lerp(COLOR_COLD, COLOR_MIDDLE, t * 2);
    }
    return vec3.lerp(COLOR_MIDDLE, COLOR_HIGH, (t - 0.5) * 2);
  }

  private applyWelldoneTrack(): void {
    if (!this.welldoneSfx || !this.welldoneSfxTrack) {
      return;
    }
    this.welldoneSfx.audioTrack = this.welldoneSfxTrack;
  }

  private configureVoiceoverAudio(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    audio.playbackMode = Audio.PlaybackMode.LowLatency;
  }

  private playAudio(audio: AudioComponent, label: string): void {
    if (!audio) {
      return;
    }

    this.ensureAudioEnabled(audio);
    if (label === "welldoneSfx") {
      applySfxMix(audio, 1);
    } else {
      applyPlayMix(audio, 1);
    }
    audio.playbackMode = Audio.PlaybackMode.LowLatency;

    try {
      audio.play(1);
      if (label === "welldoneSfx") {
        this.welldoneSfxPlaying = true;
      } else if (label === "temperatureSolveVo") {
        this.temperatureSolveVoPlaying = true;
      }
    } catch (error) {
      print(`[TemperatureWater] play(${label}) skipped: ${error}`);
      if (label === "welldoneSfx") {
        this.playAudio(this.temperatureSolveVo, "temperatureSolveVo");
      }
    }
  }

  private safeStopIfPlaying(audio: AudioComponent, label: string): void {
    const isPlaying =
      label === "welldoneSfx"
        ? this.welldoneSfxPlaying
        : label === "temperatureSolveVo"
          ? this.temperatureSolveVoPlaying
          : false;

    if (!audio || !isPlaying) {
      return;
    }

    try {
      this.muteClip(audio);
    } catch (error) {
      print(`[TemperatureWater] mute(${label}) skipped: ${error}`);
    }

    if (label === "welldoneSfx") {
      this.welldoneSfxPlaying = false;
    } else if (label === "temperatureSolveVo") {
      this.temperatureSolveVoPlaying = false;
    }
  }

  private setTemperatureSliderVisible(visible: boolean): void {
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

  private setClownfishVisible(visible: boolean): void {
    if (!this.clownfishCircling) {
      return;
    }
    this.clownfishCircling.enabled = visible;
  }

  private setFishMotionScale(scale: number): void {
    if (!this.clownfishCircling) {
      return;
    }

    const orbit = this.clownfishCircling.getComponent(
      ClownfishOrbit.getTypeName()
    ) as ClownfishOrbit;
    if (orbit) {
      orbit.setMotionScale(scale);
    }
  }

  private ensureAudioEnabled(audio: AudioComponent): void {
    if (!audio.enabled) {
      audio.enabled = true;
    }
    const owner = audio.getSceneObject();
    if (owner && !owner.enabled) {
      owner.enabled = true;
    }
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

  private muteClip(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    applyMuteMix(audio);
    audio.enabled = false;
  }
}
