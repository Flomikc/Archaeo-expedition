import {
  AbstractMesh,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";

/**
 * Фотоаппарат: world-модель на столе + viewmodel у камеры.
 */
export class CameraItem {
  readonly worldRoot: TransformNode;
  readonly worldMeshes: AbstractMesh[] = [];
  private viewRoot: TransformNode | null = null;
  private kick = 0;
  private owned = false;

  constructor(
    private readonly scene: Scene,
    worldPosition: Vector3
  ) {
    this.worldRoot = new TransformNode("cameraWorld", scene);
    this.worldRoot.position.copyFrom(worldPosition);

    const bodyMat = new StandardMaterial("camBody", scene);
    bodyMat.diffuseColor = new Color3(0.15, 0.15, 0.18);
    bodyMat.specularColor = new Color3(0.15, 0.15, 0.15);

    const lensMat = new StandardMaterial("camLens", scene);
    lensMat.diffuseColor = new Color3(0.08, 0.1, 0.14);
    lensMat.emissiveColor = new Color3(0.02, 0.04, 0.06);
    lensMat.specularColor = new Color3(0.4, 0.4, 0.4);

    const body = MeshBuilder.CreateBox("camBody", { width: 0.32, height: 0.2, depth: 0.18 }, scene);
    body.position.set(0, 0.1, 0);
    body.material = bodyMat;
    body.parent = this.worldRoot;
    body.checkCollisions = false;
    body.isPickable = true;
    this.worldMeshes.push(body);

    const lens = MeshBuilder.CreateCylinder("camLens", { height: 0.12, diameter: 0.1, tessellation: 12 }, scene);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.1, 0.14);
    lens.material = lensMat;
    lens.parent = this.worldRoot;
    lens.isPickable = true;
    this.worldMeshes.push(lens);

    // Триггер для InteractionSystem
    const trigger = MeshBuilder.CreateBox("camTrigger", { width: 0.6, height: 0.5, depth: 0.5 }, scene);
    trigger.position.set(0, 0.15, 0);
    trigger.visibility = 0;
    trigger.isPickable = true;
    trigger.checkCollisions = false;
    trigger.parent = this.worldRoot;
    this.worldMeshes.push(trigger);
  }

  get interactionMesh(): AbstractMesh {
    return this.worldMeshes[this.worldMeshes.length - 1];
  }

  get isOwned(): boolean {
    return this.owned;
  }

  /** Поднять со стола → показать viewmodel. */
  pickup(camera: UniversalCamera): void {
    if (this.owned) return;
    this.owned = true;
    this.worldRoot.setEnabled(false);

    this.viewRoot = new TransformNode("cameraView", this.scene);
    this.viewRoot.parent = camera;
    this.viewRoot.position.set(0.28, -0.28, 0.55);
    this.viewRoot.rotation.set(0.15, -0.25, 0.05);

    const bodyMat = new StandardMaterial("vmBody", this.scene);
    bodyMat.diffuseColor = new Color3(0.18, 0.18, 0.2);
    bodyMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const lensMat = new StandardMaterial("vmLens", this.scene);
    lensMat.diffuseColor = new Color3(0.1, 0.12, 0.16);
    lensMat.emissiveColor = new Color3(0.03, 0.05, 0.08);

    const body = MeshBuilder.CreateBox("vmBody", { width: 0.14, height: 0.09, depth: 0.08 }, this.scene);
    body.material = bodyMat;
    body.parent = this.viewRoot;
    body.isPickable = false;

    const lens = MeshBuilder.CreateCylinder("vmLens", { height: 0.06, diameter: 0.05, tessellation: 10 }, this.scene);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.06);
    lens.material = lensMat;
    lens.parent = this.viewRoot;
    lens.isPickable = false;
  }

  /** Анимация «выстрела» viewmodel. */
  shootKick(): void {
    this.kick = 0.08;
    this.playClickSound();
  }

  update(dt: number): void {
    if (!this.viewRoot) return;
    if (this.kick > 0) {
      this.kick = Math.max(0, this.kick - dt * 0.35);
    }
    this.viewRoot.position.y = -0.28 + this.kick;
  }

  dispose(): void {
    this.viewRoot?.dispose();
    this.worldRoot.dispose();
  }

  private playClickSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
