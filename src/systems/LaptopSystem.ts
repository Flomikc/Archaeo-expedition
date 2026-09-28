import {
    Scene,
    UniversalCamera,
    Vector3,
  } from "@babylonjs/core";
  
  import { Player } from "../entities/Player";
  
  export interface LaptopSystemOptions {
    scene: Scene;
    canvas: HTMLCanvasElement;
    player: Player;
    /** Позиция, куда должна улететь камера (перед экраном ноутбука). */
    screenPosition: Vector3;
    /** Точка, на которую смотрит камера после подлёта. */
    screenLookAt: Vector3;
    /** Как долго длится подлёт/отлёт в секундах. */
    flightDuration?: number;
  }
  
  /**
   * Управляет "фокусом" на ноутбуке: камера плавно улетает к экрану,
   * курсор освобождается, Player отключается. При закрытии — всё возвращается.
   */
  export class LaptopSystem {
    private readonly scene: Scene;
    private readonly canvas: HTMLCanvasElement;
    private readonly player: Player;
    private readonly camera: UniversalCamera;
    private readonly screenPosition: Vector3;
    private readonly screenLookAt: Vector3;
    private readonly flightDuration: number;
  
    private isOpen = false;
    private isFlying = false;
  
    /** Сохранённые позиция/цель камеры — восстанавливаем при закрытии. */
    private savedPosition = Vector3.Zero();
    private savedTarget = Vector3.Zero();
  
    constructor(options: LaptopSystemOptions) {
      this.scene = options.scene;
      this.canvas = options.canvas;
      this.player = options.player;
      this.camera = options.player.camera;
      this.screenPosition = options.screenPosition.clone();
      this.screenLookAt = options.screenLookAt.clone();
      this.flightDuration = options.flightDuration ?? 0.8;
    }
  
    get isActive(): boolean {
      return this.isOpen;
    }
  
    get isBusy(): boolean {
      return this.isFlying;
    }
  
    /**
     * Открыть ноутбук. Возвращает промис, который резолвится,
     * когда камера уже прилетела и можно показывать UI.
     */
    async open(): Promise<void> {
      if (this.isOpen || this.isFlying) return;
      this.isFlying = true;
  
      this.savedPosition.copyFrom(this.camera.position);
      this.savedTarget.copyFrom(
        this.camera.position.add(this.camera.getDirection(Vector3.Forward()))
      );
  
      this.player.setEnabled(false);
      this.camera.detachControl();
  
      await this.flyTo(this.screenPosition, this.screenLookAt);
  
      this.isFlying = false;
      this.isOpen = true;
  
      // Выходим из pointer lock, чтобы игрок мог кликать по UI
      document.exitPointerLock?.();
    }
  
    /** Закрыть ноутбук. Возвращает промис, когда камера вернулась. */
    async close(): Promise<void> {
      if (!this.isOpen || this.isFlying) return;
      this.isFlying = true;
      this.isOpen = false;
  
      await this.flyTo(this.savedPosition, this.savedTarget);
  
      this.isFlying = false;
      this.player.setEnabled(true);
      this.camera.attachControl(this.canvas, true);
      this.camera.setTarget(this.savedTarget);
    }
  
    /** Прервать навигацию (например, при ESC). */
    forceCloseSync(): void {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.isFlying = false;
      this.camera.position.copyFrom(this.savedPosition);
      this.camera.setTarget(this.savedTarget);
      this.player.setEnabled(true);
      this.camera.attachControl(this.canvas, true);
    }
  
    // ------------------------------------------------------------- private
  
    private flyTo(targetPos: Vector3, targetLookAt: Vector3): Promise<void> {
      return new Promise((resolve) => {
        const startPos = this.camera.position.clone();
        const startLook = this.camera.position.add(
          this.camera.getDirection(Vector3.Forward())
        );
        const endPos = targetPos.clone();
        const endLook = targetLookAt.clone();
  
        let elapsed = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
          elapsed += this.scene.getEngine().getDeltaTime() / 1000;
          const raw = Math.min(1, elapsed / this.flightDuration);
          const t = raw * raw * (3 - 2 * raw); // smoothstep
  
          this.camera.position.copyFrom(
            Vector3.Lerp(startPos, endPos, t)
          );
          const look = Vector3.Lerp(startLook, endLook, t);
          this.camera.setTarget(look);
  
          if (raw >= 1) {
            this.scene.onBeforeRenderObservable.remove(obs);
            resolve();
          }
        });
      });
    }
  }