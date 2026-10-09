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

// ── Позиции viewmodel ────────────────────────────────────────
const REST_POS = new Vector3(0.32, -0.32, 0.62);
const REST_ROT = new Vector3(0.15, -0.25, 0.05);

const AIM_POS = new Vector3(0, -0.03, 0.34);
const AIM_ROT = new Vector3(0, 0, 0);

const RAISE_TIME = 0.32;
const LOWER_TIME = 0.34;

type RaiseState = "idle" | "raising" | "aiming" | "lowering";

export class CameraItem {
  readonly worldRoot: TransformNode;
  readonly worldMeshes: AbstractMesh[];

  private viewRoot: TransformNode | null = null;
  private kick = 0;
  private owned = false;

  private raiseState: RaiseState = "idle";
  private raiseT = 0;

  private redrawRec: ((visible: boolean) => void) | null = null;
  private recTimer = 0;
  private recVisible = true;

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

  get isRaised(): boolean {
    return this.raiseState === "aiming";
  }

  get isAnimating(): boolean {
    return this.raiseState === "raising" || this.raiseState === "lowering";
  }

  startRaise(): void {
    if (!this.owned) return;
    if (this.raiseState === "raising" || this.raiseState === "aiming") return;
    this.raiseState = "raising";
    this.raiseT = 0;
  }

  startLower(): void {
    if (!this.owned) return;
    if (this.raiseState === "lowering" || this.raiseState === "idle") return;
    this.raiseState = "lowering";
    this.raiseT = 0;
  }

  shoot(): void {
    if (!this.owned) return;
    this.kick = 0.08;
    this.playClickSound();
  }

  pickup(camera: UniversalCamera): void {
    if (this.owned) return;
    this.owned = true;
    this.worldRoot.setEnabled(false);

    // Depth сохраняется между группами 0 → 1 → 2. Маска в группе 1
    // пишет depth, корпус в группе 2 в её области не рисуется —
    // получается окно в мир.
    this.scene.setRenderingAutoClearDepthStencil(1, false);
    this.scene.setRenderingAutoClearDepthStencil(2, false);

    const placeholder = createCameraViewModelPlaceholder(this.scene);
    this.viewRoot = placeholder.root;
    this.viewRoot.parent = camera;
    this.viewRoot.position.copyFrom(REST_POS);
    this.viewRoot.rotation.set(REST_ROT.x, REST_ROT.y, REST_ROT.z);

    if (placeholder.redrawRec) {
      this.redrawRec = placeholder.redrawRec;
    }
  }

  update(dt: number): void {
    if (!this.viewRoot) return;

    // ── Мигание REC (2 Гц) ─────────────────────────────
    if (this.redrawRec) {
      this.recTimer += dt;
      if (this.recTimer >= 0.5) {
        this.recTimer -= 0.5;
        this.recVisible = !this.recVisible;
        this.redrawRec(this.recVisible);
      }
    }

    if (this.raiseState === "raising") {
      this.raiseT += dt / RAISE_TIME;
      const k = smoothstep(Math.min(1, this.raiseT));
      lerpVec(this.viewRoot.position, REST_POS, AIM_POS, k);
      lerpVec(this.viewRoot.rotation, REST_ROT, AIM_ROT, k);
      if (this.raiseT >= 1) {
        this.viewRoot.position.copyFrom(AIM_POS);
        this.viewRoot.rotation.copyFrom(AIM_ROT);
        this.raiseState = "aiming";
        this.raiseT = 0;
      }
      return;
    }

    if (this.raiseState === "lowering") {
      this.raiseT += dt / LOWER_TIME;
      const k = smoothstep(Math.min(1, this.raiseT));
      lerpVec(this.viewRoot.position, AIM_POS, REST_POS, k);
      lerpVec(this.viewRoot.rotation, AIM_ROT, REST_ROT, k);
      if (this.raiseT >= 1) {
        this.viewRoot.position.copyFrom(REST_POS);
        this.viewRoot.rotation.copyFrom(REST_ROT);
        this.raiseState = "idle";
        this.raiseT = 0;
      }
      return;
    }

    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 0.35);
    const baseY = this.raiseState === "aiming" ? AIM_POS.y : REST_POS.y;
    this.viewRoot.position.y = baseY + this.kick;
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
      /* ignore */
    }
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpVec(target: Vector3, a: Vector3, b: Vector3, k: number): void {
  target.x = a.x + (b.x - a.x) * k;
  target.y = a.y + (b.y - a.y) * k;
  target.z = a.z + (b.z - a.z) * k;
}