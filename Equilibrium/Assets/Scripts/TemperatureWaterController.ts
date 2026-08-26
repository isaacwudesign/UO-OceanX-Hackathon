/**
 * Maps the temperature slider (Cold ↔ High) to WaterBase tint colors.
 * High = green, Middle = default blue, Cold = light blue. Alpha fixed at 63%.
 * Event-driven: no Update loop; slider callbacks only.
 */
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";

const WATER_OPACITY = 0.63;
const TARGET_TEMPERATURE = 0.5;

const COLOR_COLD = new vec3(0.658824, 0.921569, 0.956863); // #a8ebf4
const COLOR_MIDDLE = new vec3(0.047059, 0.717647, 1.0); // #0CB7FF
const COLOR_HIGH = new vec3(0.596078, 0.8, 0.4); // #98cc66

const DEFAULT_SLIDER_VALUE = 1;

@component
export class TemperatureWaterController extends BaseScriptComponent {
  @ui.group_start("References")
  @input
  @hint("WaterBase mesh whose material color will be driven by the slider")
  waterMesh: RenderMeshVisual;

  @input
  @hint("Scene object that has the UIKit Slider (TemperatureSliderControl)")
  temperatureSliderObject: SceneObject;

  @input
  @hint("Clownfish orbit group shown again when temperature is corrected")
  clownfishCircling: SceneObject;

  @input
  @hint("TempatureSlider root hidden after the solve VO finishes")
  temperatureSlider: SceneObject;
  @ui.group_end

  @ui.group_start("Correct Temperature Feedback")
  @input
  @hint("SFX played when the slider reaches the middle (correct) range")
  welldoneSfx: AudioComponent;

  @input
  @hint("VO played immediately after WelldoneSFX finishes")
  temperatureSolveVo: AudioComponent;

  @input
  @widget(new SliderWidget(0.05, 0.25, 0.01))
  @hint("How close to center (0.5) counts as correct, e.g. 0.15 = 0.35–0.65")
  middleTolerance: number = 0.15;

  @input
  @hint("Ending VO played after TempatureIssueSolveVO finishes")
  endingAudio: AudioComponent;
  @ui.group_end

  private waterMaterial: Material | null = null;
  private sliderBound = false;
  private temperaturePhaseActive = false;
  private temperatureSolved = false;
  private welldoneSfxPlaying = false;
  private temperatureSolveVoPlaying = false;
  private endingAudioPlaying = false;

  onAwake() {
    this.setupWaterMaterial();
    this.configureVoiceoverAudio(this.temperatureSolveVo);
    this.configureVoiceoverAudio(this.endingAudio);

    if (this.welldoneSfx) {
      this.welldoneSfx.setOnFinish(this.onWelldoneSfxFinished.bind(this));
    }

    if (this.temperatureSolveVo) {
      this.temperatureSolveVo.setOnFinish(
        this.onTemperatureSolveVoFinished.bind(this)
      );
    }

    this.createEvent("OnStartEvent").bind(() => {
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
    this.bindSliderIfNeeded();

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
    this.safeStopIfPlaying(this.endingAudio, "endingAudio");
    this.temperaturePhaseActive = false;
    this.temperatureSolved = false;
    this.welldoneSfxPlaying = false;
    this.temperatureSolveVoPlaying = false;
    this.endingAudioPlaying = false;
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
  }

  private onSliderValueChanged(value: number): void {
    this.applySliderValue(value);
    this.checkMiddleSolution(value);
  }

  private checkMiddleSolution(value: number): void {
    if (!this.temperaturePhaseActive || this.temperatureSolved) {
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
    this.temperatureSolved = true;
    this.setClownfishVisible(true);
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
    this.playAudio(this.temperatureSolveVo, "temperatureSolveVo");
  }

  private onTemperatureSolveVoFinished(): void {
    if (!this.temperatureSolved) {
      return;
    }
    this.temperatureSolveVoPlaying = false;
    this.setTemperatureSliderVisible(false);
    this.playAudio(this.endingAudio, "endingAudio");
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

  private setupWaterMaterial(): void {
    if (!this.waterMesh || !this.waterMesh.mainMaterial) {
      return;
    }

    this.waterMaterial = this.waterMesh.mainMaterial.clone();
    this.waterMesh.mainMaterial = this.waterMaterial;
  }

  private applySliderValue(normalizedValue: number): void {
    if (!this.waterMaterial) {
      return;
    }

    const t =
      normalizedValue < 0 ? 0 : normalizedValue > 1 ? 1 : normalizedValue;
    const rgb = this.temperatureToColor(t);
    this.waterMaterial.mainPass.baseColor = new vec4(
      rgb.x,
      rgb.y,
      rgb.z,
      WATER_OPACITY
    );
  }

  private temperatureToColor(t: number): vec3 {
    if (t <= 0.5) {
      return vec3.lerp(COLOR_COLD, COLOR_MIDDLE, t * 2);
    }
    return vec3.lerp(COLOR_MIDDLE, COLOR_HIGH, (t - 0.5) * 2);
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

    try {
      audio.play(1);
      if (label === "welldoneSfx") {
        this.welldoneSfxPlaying = true;
      } else if (label === "temperatureSolveVo") {
        this.temperatureSolveVoPlaying = true;
      } else if (label === "endingAudio") {
        this.endingAudioPlaying = true;
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
          : label === "endingAudio"
            ? this.endingAudioPlaying
            : false;

    if (!audio || !isPlaying) {
      return;
    }

    try {
      if (audio.enabled) {
        audio.stop(false);
      }
    } catch (error) {
      print(`[TemperatureWater] stop(${label}) skipped: ${error}`);
    }

    if (label === "welldoneSfx") {
      this.welldoneSfxPlaying = false;
    } else if (label === "temperatureSolveVo") {
      this.temperatureSolveVoPlaying = false;
    } else if (label === "endingAudio") {
      this.endingAudioPlaying = false;
    }
  }

  private setTemperatureSliderVisible(visible: boolean): void {
    if (!this.temperatureSlider) {
      return;
    }
    this.temperatureSlider.enabled = visible;
  }

  private setClownfishVisible(visible: boolean): void {
    if (!this.clownfishCircling) {
      return;
    }
    this.clownfishCircling.enabled = visible;
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
}
