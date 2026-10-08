import {
  Scene,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";

/**
 * Камера свободного полёта.
 *
 * Управление:
 *   WASD — движение по горизонтали (в системе координат камеры)
 *   Q / E — вниз / вверх
 *   Shift — ускорение
 *   ЛКМ — захват мыши (pointer lock)
 *   Esc — отпустить мышь
 *
 * Внутри — UniversalCamera с отключённым встроенным WASD-контролем,
 * потому что нам нужна своя логика (Q/E + Shift, отсутствие гравитации).
 */
export class FlyCamera {
  readonly camera: UniversalCamera;

  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();

  private baseSpeed = 8;
  private sprintMultiplier = 3;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    // Space не должен скроллить страницу
    if (e.code === "Space") e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
  };

  constructor(scene: Scene, canvas: HTMLCanvasElement, startPosition?: Vector3) {
    this.canvas = canvas;

    const camera = new UniversalCamera(
      "flyCamera",
      startPosition ?? new Vector3(0, 6, -20),
      scene
    );
    camera.minZ = 0.1;
    camera.maxZ = 500;
    camera.fov = 1.1;
    camera.inertia = 0.6;

    // Отключаем встроенное WASD-управление (двигаем вручную)
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    // Никаких коллизий/гравитации
    camera.checkCollisions = false;
    camera.applyGravity = false;

    camera.attachControl(canvas, true);

    // Смотрим в центр комнаты
    camera.setTarget(new Vector3(0, 1.5, 0));

    this.camera = camera;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    // Клик по canvas → pointer lock (для удобного вращения)
    canvas.addEventListener("click", () => {
      if (!document.pointerLockElement) {
        canvas.requestPointerLock?.();
      }
    });
  }

  /** Вызывать каждый кадр. */
  update(dt: number): void {
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());
    const up = Vector3.Up();

    const move = Vector3.Zero();

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    move.addInPlace(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  move.subtractInPlace(forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.addInPlace(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  move.subtractInPlace(right);

    // Q/E — вниз/вверх в МИРОВОЙ системе (не в системе камеры),
    // чтобы можно было подняться над комнатой, глядя вниз.
    if (this.keys.has("KeyQ")) move.subtractInPlace(up);
    if (this.keys.has("KeyE")) move.addInPlace(up);

    if (move.lengthSquared() < 0.0001) return;

    move.normalize();
    const sprint = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"))
      ? this.sprintMultiplier
      : 1;
    move.scaleInPlace(this.baseSpeed * sprint * dt);

    this.camera.position.addInPlace(move);
  }

  /** Плавно вернуть камеру в стартовую точку. */
  resetTo(position: Vector3, lookAt: Vector3): void {
    this.camera.position.copyFrom(position);
    this.camera.setTarget(lookAt);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.camera.dispose();
  }
}