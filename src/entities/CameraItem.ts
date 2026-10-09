import {
  AbstractMesh,
  Color4,
  RenderTargetTexture,
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
const REST_POS = new Vector3(0.28, -0.28, 0.55);
const REST_ROT = new Vector3(0.15, -0.25, 0.05);

const AIM_POS = new Vector3(0, -0.05, 0.35);
const AIM_ROT = new Vector3(0, 0, 0);

const RAISE_TIME = 0.22;
const AIM_HOLD = 0.15;
const LOWER_TIME = 0.25;

// refreshRate для RTT: чем больше число, тем реже рендер.
const RTT_RATE_IDLE = 4;    // idle — раз в 4 кадра
const RTT_RATE_AIM  = 1;    // при съёмке — каждый кадр

export interface ShotCallbacks {
  onAimReached?: () => void;
  onReturned?: () => void;
}

type ShotState = "idle" | "raising" | "aiming" | "lowering";

export class CameraItem {
  readonly worldRoot: TransformNode;
  readonly worldMeshes: AbstractMesh[];

  private viewRoot: TransformNode | null = null;
  private kick = 0;
  private owned = false;

  private shotState: ShotState = "idle";
  private shotT = 0;
  private shotCallbacks: ShotCallbacks = {};

  /** RTT — живой вид с камеры игрока. Всегда активен. */
  private screenRTT: RenderTargetTexture | null = null;

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

  get isShooting(): boolean {
    return this.shotState !== "idle";
  }

  startShot(callbacks: ShotCallbacks = {}): void {
    if (!this.owned) return;
    if (this.shotState !== "idle") return;

    // Ускоряем обновление RTT на время съёмки.
    if (this.screenRTT) this.screenRTT.refreshRate = RTT_RATE_AIM;

    this.kick = 0;
    this.shotState = "raising";
    this.shotT = 0;
    this.shotCallbacks = callbacks;
  }

  pickup(camera: UniversalCamera): void {
    if (this.owned) return;
    this.owned = true;
    this.worldRoot.setEnabled(false);

    // ── RTT ────────────────────────────────────────────────
    // Всегда в customRenderTargets. Регулируем только частоту.
    const rtt = new RenderTargetTexture(
      "cameraScreen",
      { width: 192, height: 128 },
      this.scene,
      false
    );
    rtt.activeCamera = camera;
    rtt.clearColor = new Color4(0, 0, 0, 1);
    rtt.refreshRate = RTT_RATE_IDLE;
    rtt.renderParticles = false;
    rtt.renderSprites = false;
    rtt.skipInitialClear = false;
    this.screenRTT = rtt;

    // ── Исключаем viewmodel из RTT (иначе — рекурсия) ──────
    const viewSet = new Set<AbstractMesh>();

    // ── Viewmodel ──────────────────────────────────────────
    const placeholder = createCameraViewModelPlaceholder(this.scene, rtt);
    this.viewRoot = placeholder.root;
    this.viewRoot.parent = camera;
    this.viewRoot.position.copyFrom(REST_POS);
    this.viewRoot.rotation.set(REST_ROT.x, REST_ROT.y, REST_ROT.z);

    // Заполняем viewSet после создания viewmodel.
    for (const m of placeholder.meshes) viewSet.add(m);
    rtt.renderListPredicate = (mesh) => !viewSet.has(mesh);

    // ── Добавляем в очередь рендера сцены ──────────────────
    this.scene.customRenderTargets.push(rtt);
  }

  shootKick(): void {
    this.kick = 0.08;
    this.playClickSound();
  }

  update(dt: number): void {
    if (!this.viewRoot) return;

    if (this.shotState !== "idle") {
      const duration =
        this.shotState === "raising" ? RAISE_TIME :
        this.shotState === "aiming"  ? AIM_HOLD   :
        LOWER_TIME;

      this.shotT += dt / duration;

      if (this.shotState === "raising") {
        const k = smoothstep(Math.min(1, this.shotT));
        lerpVec(this.viewRoot.position, REST_POS, AIM_POS, k);
        lerpVec(this.viewRoot.rotation, REST_ROT, AIM_ROT, k);
        if (this.shotT >= 1) {
          this.shotState = "aiming";
          this.shotT = 0;
          this.shotCallbacks.onAimReached?.();
        }
      } else if (this.shotState === "aiming") {
        if (this.shotT >= 1) {
          this.shotState = "lowering";
          this.shotT = 0;
        }
      } else if (this.shotState === "lowering") {
        const k = smoothstep(Math.min(1, this.shotT));
        lerpVec(this.viewRoot.position, AIM_POS, REST_POS, k);
        lerpVec(this.viewRoot.rotation, AIM_ROT, REST_ROT, k);
        if (this.shotT >= 1) {
          this.shotState = "idle";
          this.shotT = 0;
          this.shotCallbacks.onReturned?.();
          this.shotCallbacks = {};

          // Возвращаем медленный режим RTT.
          if (this.screenRTT) this.screenRTT.refreshRate = RTT_RATE_IDLE;
        }
      }
      return;
    }

    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 0.35);
    this.viewRoot.position.y = REST_POS.y + this.kick;
  }

  dispose(): void {
    if (this.screenRTT) {
      const idx = this.scene.customRenderTargets.indexOf(this.screenRTT);
      if (idx >= 0) this.scene.customRenderTargets.splice(idx, 1);
      this.screenRTT.dispose();
    }
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