import {
    Mesh,
    MeshBuilder,
    Scene,
    SpotLight,
    UniversalCamera,
    Vector3,
  } from "@babylonjs/core";
  
  import { SettingsData, SettingsSystem } from "../systems/SettingsSystem";
  
  export interface PlayerOptions {
    scene: Scene;
    canvas: HTMLCanvasElement;
    /** Стартовая позиция (X/Z берутся отсюда, Y = eyeHeight). */
    position: Vector3;
    eyeHeight?: number;
    speed?: number;
  }
  
  /**
   * Контроллер игрока от первого лица.
   *
   * Физика разделена на два объекта:
   *   • body  — невидимая капсула, у Mesh есть moveWithCollisions и ellipsoid;
   *   • camera — «глаза», катается за body, крутится штатным mouse-look'ом.
   *
   * Прыжок реализован вручную (гравитация + verticalVelocity), при этом
   * Y тела каждый кадр жёстко клампится к уровню земли — это гарантирует,
   * что игрок никогда не «уезжает» под мебель / сквозь пол.
   */
  export class Player {
    readonly camera: UniversalCamera;
  
    private readonly body: Mesh;
    private readonly bodyHalfHeight = 0.9;
  
    private readonly scene: Scene;
    private readonly canvas: HTMLCanvasElement;
    private readonly eyeHeight: number;
    private readonly speed: number;
    private readonly cameraOffsetY: number;
  
    private enabled = true;
    private readonly keys = new Set<string>();
    private flashlight: SpotLight | null = null;
  
    // --- Вертикальное движение ---
    private verticalVelocity = 0;
    private isGrounded = false;
    private readonly gravity = 22;
    private readonly jumpSpeed = 5.6;
  
    private readonly unsubscribeSettings: () => void;
  
    // ------------------------------------------------------------------ input
  
    private readonly onKeyDown = (e: KeyboardEvent): void => {
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    };
  
    private readonly onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
  
    private readonly onBlur = (): void => {
      this.keys.clear();
    };
  
    // ----------------------------------------------------------------- ctor
  
    constructor(options: PlayerOptions) {
      this.scene = options.scene;
      this.canvas = options.canvas;
      this.eyeHeight = options.eyeHeight ?? 1.7;
      this.speed = options.speed ?? 3.6;
  
      const bodyHalfHeight = this.bodyHalfHeight;
  
      // ---------- Тело ----------
      const body = MeshBuilder.CreateBox(
        "playerBody",
        { width: 0.6, height: bodyHalfHeight * 2, depth: 0.6 },
        this.scene
      );
      body.isVisible = false;
      body.isPickable = false;
      body.checkCollisions = true;
      body.ellipsoid = new Vector3(0.35, bodyHalfHeight, 0.35);
      body.position.set(options.position.x, bodyHalfHeight, options.position.z);
      this.body = body;
  
      // ---------- Камера ----------
      const camera = new UniversalCamera(
        "playerCamera",
        new Vector3(options.position.x, this.eyeHeight, options.position.z),
        this.scene
      );
      camera.minZ = 0.1;
      camera.maxZ = 300;
      camera.fov = 1.15;
      camera.inertia = 0.55;
  
      // Отключаем встроенное WASD-управление — двигаем тело сами
      camera.keysUp = [];
      camera.keysDown = [];
      camera.keysLeft = [];
      camera.keysRight = [];
  
      // Коллизии обрабатывает body, не камера
      camera.checkCollisions = false;
      camera.applyGravity = false;
  
      camera.attachControl(this.canvas, true);
  
      this.camera = camera;
      this.cameraOffsetY = this.eyeHeight - bodyHalfHeight;
  
      // ---------- Настройки ----------
      this.unsubscribeSettings = SettingsSystem.subscribe((s) => this.applySettings(s));
      this.applySettings(SettingsSystem.get());
  
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      window.addEventListener("blur", this.onBlur);
    }
  
    // ---------------------------------------------------------------- public
  
    /** Полностью отключает/включает управление (для пауз/меню). */
    setEnabled(value: boolean): void {
      if (this.enabled === value) return;
      this.enabled = value;
  
      if (!value) {
        this.keys.clear();
        this.verticalVelocity = 0;
        this.camera.detachControl();
      } else {
        this.camera.attachControl(this.canvas, true);
      }
    }
  
    /** Создаёт фонарик, привязанный к камере. */
    enableFlashlight(): SpotLight {
      const light = new SpotLight(
        "flashlight",
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1),
        1.0,   // angle — перезапишется из настроек
        2,     // exponent
        this.scene
      );
      light.range = 15;
      light.diffuse.set(1, 0.96, 0.85);
      light.specular.set(0.4, 0.4, 0.4);
      this.flashlight = light;
  
      // Применяем актуальные настройки
      this.applySettings(SettingsSystem.get());
      return light;
    }
  
    update(dt: number): void {
      if (this.flashlight) {
        const forward = this.camera.getDirection(Vector3.Forward());
        const right = this.camera.getDirection(Vector3.Right());
        this.flashlight.position.copyFrom(
          this.camera.position.add(right.scale(0.18)).add(new Vector3(0, -0.12, 0))
        );
        this.flashlight.direction.copyFrom(forward);
      }

      // ---------- Горизонталь ----------
      if (this.enabled) {
        const forward = this.camera.getDirection(Vector3.Forward());
        forward.y = 0; forward.normalize();
        const right = this.camera.getDirection(Vector3.Right());
        right.y = 0; right.normalize();

        const move = Vector3.Zero();
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp"))    move.addInPlace(forward);
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown"))  move.subtractInPlace(forward);
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.addInPlace(right);
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft"))  move.subtractInPlace(right);

        if (move.lengthSquared() > 0.0001) {
          move.normalize();
          const sprint = (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) ? 1.75 : 1;
          move.scaleInPlace(this.speed * sprint * dt);
          this.body.moveWithCollisions(move);
        }

        if (this.isGrounded && this.keys.has("Space") && this.verticalVelocity <= 0) {
          this.verticalVelocity = this.jumpSpeed;
          this.isGrounded = false;
        }
      }

      // ---------- Вертикаль (через moveWithCollisions!) ----------
      this.verticalVelocity -= this.gravity * dt;
      if (this.verticalVelocity < -30) this.verticalVelocity = -30;

      const desired = this.verticalVelocity * dt;
      const posBeforeY = this.body.position.y;
      this.body.moveWithCollisions(new Vector3(0, desired, 0));
      const appliedY = this.body.position.y - posBeforeY;

      // Определяем, приземлились ли мы: хотели вниз, но пролетели меньше
      if (desired < -0.0001 && appliedY > desired + 0.0001) {
        this.isGrounded = true;
        this.verticalVelocity = 0;
      } else if (desired > 0.0001 && appliedY < desired - 0.0001) {
        this.verticalVelocity = 0; // удар головой о потолок
        this.isGrounded = false;
      } else {
        this.isGrounded = false;
      }

      // Аварийный респавн, если игрок улетел под мир
      if (this.body.position.y < -50) {
        this.body.position.y = this.bodyHalfHeight;
        this.verticalVelocity = 0;
      }

      // ---------- Синхронизация камеры ----------
      this.camera.position.x = this.body.position.x;
      this.camera.position.z = this.body.position.z;
      this.camera.position.y = this.body.position.y + this.cameraOffsetY;
    }
  
    dispose(): void {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("blur", this.onBlur);
      this.unsubscribeSettings();
  
      this.flashlight?.dispose();
      this.body.dispose();
      this.camera.dispose();
    }
  
    // --------------------------------------------------------------- private
  
    private applySettings(s: SettingsData): void {
      // Babylon: чем больше angularSensibility, тем медленнее поворот.
      // Мапим чувствительность 0.5..10 → 6000..300.
      this.camera.angularSensibility = 3000 / Math.max(0.1, s.sensitivity);
  
      if (this.flashlight) {
        const refAngle = 1.0;
        const refIntensity = 1.5;
        // Уже пучок → ярче; шире → тусклее (обратная зависимость).
        this.flashlight.angle = s.flashlight;
        this.flashlight.intensity = refIntensity * (refAngle / s.flashlight);
      }
    }
  }