/**
 * Orchestrates intro UI, welcome VO, surface placement, and placing instruction VO.
 * Optimized for Spectacles: event-driven flow, no per-frame work outside placement watch.
 */
import { TemperatureWaterController } from "./TemperatureWaterController";
import { Example } from "SurfacePlacement.lspkg/Example";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";

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
  @hint("Temperature UI shown after After Placing VO finishes")
  temperatureSlider: SceneObject;

  @input
  @allowUndefined
  @hint("Drives WaterBase color from the temperature slider")
  temperatureWater: TemperatureWaterController;
  @ui.group_end

  @ui.group_start("Audio")
  @input
  @hint("Welcome voice-over played during intro")
  welcomeAudio: AudioComponent;

  @input
  @hint("Instruction VO played after the user places the surface")
  placingAudio: AudioComponent;

  @input
  @hint("VO played once all four corals are placed on snap points")
  afterPlacingAudio: AudioComponent;

  @input
  @hint("VO played when the temperature slider appears")
  temperatureExplainAudio: AudioComponent;
  @ui.group_end

  private phase: ScenePhase = ScenePhase.Intro;
  private placementWatchEvent: SceneEvent | null = null;
  private afterPlacingVOPlayed = false;
  private experienceFinalized = false;
  private coralObjects: SceneObject[] = [];

  onAwake(): void {
    if (this.afterPlacingAudio) {
      this.afterPlacingAudio.setOnFinish(this.onAfterPlacingVOFinished.bind(this));
    }
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
  }

  private onStart(): void {
    this.collectCoralObjects();
    this.configureVoiceoverAudio(this.welcomeAudio);
    this.configureVoiceoverAudio(this.placingAudio);
    this.configureVoiceoverAudio(this.afterPlacingAudio);
    this.configureVoiceoverAudio(this.temperatureExplainAudio);
    this.setClownfishVisible(false);
    this.setTemperatureSliderVisible(false);
    this.enterIntro();
  }

  /** Low-latency playback for spoken VO on Spectacles (defaults to low-power otherwise). */
  private configureVoiceoverAudio(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    audio.playbackMode = Audio.PlaybackMode.LowLatency;
  }

  private collectCoralObjects(): void {
    this.coralObjects = [];
    if (!this.placedVisuals) {
      return;
    }

    const childCount = this.placedVisuals.getChildrenCount();
    for (let i = 0; i < childCount; i++) {
      const child = this.placedVisuals.getChild(i);
      if (child.name.startsWith("Coral_")) {
        this.coralObjects.push(child);
      }
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

    this.stopAudio(this.welcomeAudio);
    this.startPlacementFlow();
  }

  /** Optional: wire from Reset button if you want SceneManager to track re-placement. */
  public onResetPressed(): void {
    if (!this.surfacePlacement) {
      return;
    }

    this.surfacePlacement.resetPlacement();
    this.phase = ScenePhase.Placing;
    this.startPlacementWatch();
  }

  private enterIntro(): void {
    this.phase = ScenePhase.Intro;

    // Respect IntroFrame's enabled state from the editor — do not force it on here.
    // (Previously this set enabled = true on every refresh, so unchecking it had no effect.)

    this.stopAudio(this.placingAudio);

    if (!this.introFrame || this.introFrame.enabled) {
      this.playAudio(this.welcomeAudio);
    }
  }

  private startPlacementFlow(): void {
    this.phase = ScenePhase.Placing;

    if (this.surfacePlacement) {
      this.surfacePlacement.startPlacement();
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

    if (!this.placedVisuals || !this.placedVisuals.enabled) {
      return;
    }

    this.finishPlacement();
  }

  private finishPlacement(): void {
    this.phase = ScenePhase.Placed;

    if (this.placementWatchEvent) {
      this.placementWatchEvent.enabled = false;
    }

    this.playAudio(this.placingAudio);
  }

  /**
   * Called by CoralSnapManager when snap slot occupancy changes.
   * Plays afterPlacingAudio only when every snap point is filled.
   */
  public onCoralPlacementChanged(filledCount: number, totalSlots: number): void {
    if (totalSlots <= 0) {
      return;
    }

    if (filledCount < totalSlots) {
      const shouldResetTemperature =
        this.afterPlacingVOPlayed || this.experienceFinalized;

      this.afterPlacingVOPlayed = false;
      this.experienceFinalized = false;
      this.setClownfishVisible(false);
      this.setPlatformVisible(true);
      this.setCoralsInteractionLocked(false);
      this.setTemperatureSliderVisible(false);
      this.safeStopAudio(this.afterPlacingAudio);
      this.safeStopAudio(this.temperatureExplainAudio);
      if (this.temperatureWater && shouldResetTemperature) {
        this.temperatureWater.resetTemperatureChallenge();
      }
      return;
    }

    if (this.afterPlacingVOPlayed) {
      return;
    }

    this.afterPlacingVOPlayed = true;
    this.setClownfishVisible(true);
    this.playAudio(this.afterPlacingAudio);
  }

  private onAfterPlacingVOFinished(): void {
    if (!this.afterPlacingVOPlayed || this.experienceFinalized) {
      return;
    }
    this.finalizeExperience();
  }

  private finalizeExperience(): void {
    this.experienceFinalized = true;
    this.setPlatformVisible(false);
    this.setCoralsInteractionLocked(true);
    this.setClownfishVisible(false);
    this.setTemperatureSliderVisible(true);
    if (this.temperatureWater) {
      this.temperatureWater.applyHighDefault();
    }
    this.playAudio(this.temperatureExplainAudio);
  }

  private setPlatformVisible(visible: boolean): void {
    if (!this.platform) {
      return;
    }
    this.platform.enabled = visible;
  }

  private setTemperatureSliderVisible(visible: boolean): void {
    if (!this.temperatureSlider) {
      return;
    }
    this.temperatureSlider.enabled = visible;
  }

  private setCoralsInteractionLocked(locked: boolean): void {
    for (let i = 0; i < this.coralObjects.length; i++) {
      this.setCoralInteractionLocked(this.coralObjects[i], locked);
    }
  }

  private setCoralInteractionLocked(coral: SceneObject, locked: boolean): void {
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
    this.clownfishCircling.enabled = visible;
  }

  private playAudio(audio: AudioComponent): void {
    if (!audio) {
      return;
    }
    audio.play(1);
  }

  private stopAudio(audio: AudioComponent): void {
    this.safeStopAudio(audio);
  }

  /**
   * Only stops audio that has been played. Spectacles throws if stop() runs
   * before the native audio player was ever started via play().
   */
  private safeStopAudio(audio: AudioComponent): void {
    if (!audio || !audio.enabled) {
      return;
    }
    const owner = audio.getSceneObject();
    if (owner && !owner.enabled) {
      return;
    }

    try {
      audio.stop(false);
    } catch (error) {
      print(`[SceneManager] stop audio skipped: ${error}`);
    }
  }
}
