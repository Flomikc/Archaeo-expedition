import {
  AbstractMesh,
  Scene,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";

import {
  createCameraViewModelPlaceholder,
  createCameraWorldPlaceholder,
} from "./placeholders";

/**
 * Фотоаппарат: world-модель на столе + viewmodel в руке.
 * Вся геометрия — в placeholders.ts.
 */
export class CameraItem {
  readonly worldRoot: TransformNode;
  readonly worldMeshes: AbstractMesh[];

  private viewRoot: TransformNode | null = null;
  private kick = 0;
  private owned = false;

  constructor(private readonly scene: Scene, worldPosition: Vector3) {
    const placeholder = createCameraWorldPlaceholder(scene);
    this.worldRoot = placeholder.root;
    this.worldRoot.position.copyFrom(worldPosition);
    this.worldMeshes = placeholder.meshes;
  }

  get interactionMesh(): AbstractMesh {
    return this.worldMeshes[this.worldMeshes.length - 1];
  }

  get isOwned(): boolean {
    return this.owned;
  }

  pickup(camera: UniversalCamera): void {
    if (this.owned) return;
    this.owned = true;
    this.worldRoot.setEnabled(false);

    const placeholder = createCameraViewModelPlaceholder(this.scene);
    this.viewRoot = placeholder.root;
    this.viewRoot.parent = camera;
    this.viewRoot.position.set(0.28, -0.28, 0.55);
    this.viewRoot.rotation.set(0.15, -0.25, 0.05);
  }

  shootKick(): void {
    this.kick = 0.08;
    this.playClickSound();
  }

  update(dt: number): void {
    if (!this.viewRoot) return;
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 0.35);
    this.viewRoot.position.y = -0.28 + this.kick;
  }

  dispose(): void {
    this.viewRoot?.dispose();
    this.worldRoot.dispose();
  }

  private playClickSound(): void {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1800;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      setTimeout(() => ctx.close(), 200);
    } catch {
      /* audio may be blocked */
    }
  }
}