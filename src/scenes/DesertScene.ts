import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import { Player } from "../entities/Player";
import {
  createPathStone,
  createPyramidEntrance,
  createPyramidExterior,
  createTruckExterior,
} from "../entities/placeholders";
import { Atmosphere } from "../systems/Atmosphere";
import { InteractionSystem } from "../systems/InteractionSystem";
import { LockpickSystem } from "../systems/LockpickSystem";
import { SaveSystem } from "../systems/SaveSystem";
import { ShopSystem } from "../systems/ShopSystem";
import { HUD } from "../ui/HUD";

export interface DesertSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  onEnterPyramid: () => void;
  onReturnToHub: () => void;
}

export class DesertScene {
  readonly scene: Scene;

  private readonly options: DesertSceneOptions;
  private readonly hud: HUD;
  private readonly engine: Engine;

  private readonly player: Player;
  private readonly interaction: InteractionSystem;
  private readonly atmosphere: Atmosphere;
  private readonly lockpick = new LockpickSystem();

  private doorMesh!: Mesh;
  private doorSlab!: Mesh;
  private doorUnlocked = false;
  private menuOpen = false;
  private enterZone!: Mesh;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== "KeyE") return;
    if (this.menuOpen || this.lockpick.isOpen()) return;
    this.interaction.interact();
  };

  constructor(options: DesertSceneOptions) {
    this.options = options;
    this.hud = options.hud;
    this.engine = options.engine;

    this.scene = new Scene(options.engine);
    this.scene.clearColor = new Color4(0.72, 0.55, 0.32, 1);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    this.atmosphere.apply("desert");

    const sun = new DirectionalLight("sun", new Vector3(-0.4, -0.85, 0.3), this.scene);
    sun.intensity = 1.35;
    sun.diffuse = new Color3(1, 0.92, 0.75);
    sun.specular = new Color3(0.4, 0.35, 0.25);

    const ambient = new HemisphericLight("desertAmb", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.35;
    ambient.diffuse = new Color3(0.9, 0.75, 0.55);
    ambient.groundColor = new Color3(0.35, 0.28, 0.18);

    this.buildGround();
    this.buildTruckAndPyramid();
    this.buildPath();
    this.buildDoor();

    this.player = new Player({
      scene: this.scene,
      canvas: options.canvas,
      position: new Vector3(-13, 1.7, 2),
      speed: 4.2,
    });
    this.player.camera.rotation.y = -0.4;

    this.interaction = new InteractionSystem(this.scene, this.player.camera);

    // Взаимодействие с дверью (замок)
    this.interaction.register({
      mesh: this.doorMesh,
      hint: "E — открыть каменный замок",
      range: 4.5,
      enabled: () => !this.doorUnlocked && !this.lockpick.isOpen() && !this.menuOpen,
      onInteract: () => void this.tryOpenDoor(),
    });

    // Взаимодействие с дверью (вход) — после взлома
    this.interaction.register({
      mesh: this.enterZone,
      hint: "E — войти в пирамиду",
      range: 4,
      enabled: () => this.doorUnlocked && !this.menuOpen,
      onInteract: () => this.options.onEnterPyramid(),
    });

    // Вернуться в фуру
    const backTrigger = MeshBuilder.CreateBox("backToTruck", { width: 3, height: 3, depth: 3 }, this.scene);
    backTrigger.position.set(-13, 1.5, 0);
    backTrigger.visibility = 0;
    backTrigger.isPickable = true;
    backTrigger.checkCollisions = false;
    this.interaction.register({
      mesh: backTrigger,
      hint: "E — вернуться в фуру",
      range: 3,
      enabled: () => !this.menuOpen && !this.lockpick.isOpen(),
      onInteract: () => this.options.onReturnToHub(),
    });

    this.hud.setHudMode("hub");
    this.hud.showHud(true);
    this.hud.setHint(null);

    window.addEventListener("keydown", this.onKeyDown);
  }

  setEnabled(value: boolean): void {
    this.player.setEnabled(value);
  }

  shouldSuppressPause(): boolean {
    return this.menuOpen || this.lockpick.isOpen();
  }

  update(dt: number): void {
    if (this.menuOpen || this.lockpick.isOpen()) return;
    this.player.update(dt);
    this.interaction.update();
    this.hud.setHint(this.interaction.getHint());
    this.atmosphere.update(dt);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.atmosphere.dispose();
    this.player.dispose();
    this.scene.dispose();
  }

  // ============================================================== логика

  /**
   * Проверяет наличие отмычки/автовзлома в инвентаре.
   *  • Есть отмычка → запускаем мини-игру.
   *  • Нет отмычки, но есть автовзлом → тратим 1 автовзлом, дверь открывается.
   *  • Нет ничего → тост «Купи отмычку в ноутбуке».
   */
  private async tryOpenDoor(): Promise<void> {
    if (this.doorUnlocked || this.lockpick.isOpen()) return;

    const bonuses = ShopSystem.getRuntimeBonuses();

    if (!bonuses.hasLockpick && bonuses.autopickCount <= 0) {
      this.hud.showToast("Нужна отмычка или автовзлом. Купи в ноутбуке.", 3000);
      return;
    }

    // Если нет отмычки, но есть автовзлом — используем
    if (!bonuses.hasLockpick && bonuses.autopickCount > 0) {
      ShopSystem.consume("autopick");
      this.doorUnlocked = true;
      this.animateDoorOpen();
      this.hud.showToast("Автовзлом использован. Дверь открыта.", 3000);
      return;
    }

    // Иначе — мини-игра
    await this.runLockpick();
  }

  private async runLockpick(): Promise<void> {
    this.menuOpen = true;
    this.player.setEnabled(false);
    this.engine.exitPointerlock();
    this.hud.setHint(null);

    const result = await this.lockpick.start(() => {
      // onAbort — игрок нажал «вернуться к фуре»
      this.menuOpen = false;
      this.player.setEnabled(true);
      this.options.onReturnToHub();
    });

    this.menuOpen = false;

    if (result.success) {
      this.doorUnlocked = true;
      this.animateDoorOpen();
      this.hud.showToast("Дверь открыта!", 2500);
      this.player.setEnabled(true);
      this.engine.enterPointerlock();
    } else {
      // Провал без abort — маловероятно, но оставляем
      this.player.setEnabled(true);
      this.engine.enterPointerlock();
    }
  }

  private animateDoorOpen(): void {
    const startY = this.doorSlab.position.y;
    const targetY = startY - 4;
    let t = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      t += this.scene.getEngine().getDeltaTime() / 1000;
      const k = Math.min(1, t / 1.8);
      this.doorSlab.position.y = startY + (targetY - startY) * k;
      if (k >= 1) {
        this.doorSlab.checkCollisions = false;
        this.scene.onBeforeRenderObservable.remove(obs);
      }
    });
  }

  // ============================================================== build

  private buildGround(): void {
    const ground = MeshBuilder.CreateGround("sand", { width: 140, height: 140, subdivisions: 32 }, this.scene);
    ground.position.y = 0;

    const mat = new StandardMaterial("sandMat", this.scene);
    const tex = new DynamicTexture("sandTex", { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const n = 160 + Math.floor(Math.random() * 50);
        ctx.fillStyle = `rgb(${n},${n - 20},${n - 50})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.update();
    mat.diffuseTexture = tex;
    mat.specularColor = Color3.Black();
    mat.diffuseColor = new Color3(0.85, 0.72, 0.5);
    ground.material = mat;
    ground.checkCollisions = true;
  }

  private buildTruckAndPyramid(): void {
    // Фура стоит чуть поодаль, лицом к пирамиде
    const truck = createTruckExterior(this.scene);
    truck.position.set(-15, 0, 0);
    truck.rotation.y = Math.PI / 2;

    // Пирамида вдалеке
    const pyramid = createPyramidExterior(this.scene);
    pyramid.position.set(18, 0, 0);

    const entrance = createPyramidEntrance(this.scene);
    entrance.position.set(5.5, 1.75, 0);
  }

  private buildPath(): void {
    for (let i = 0; i < 16; i++) {
      const x = -8 + i * 1.0;
      const slab = createPathStone(this.scene, `path${i}`);
      slab.position.set(x, 0.06, (Math.random() - 0.5) * 0.4);
      slab.rotation.y = (Math.random() - 0.5) * 0.15;
    }
  }

  private buildDoor(): void {
    const stone = new StandardMaterial("doorStone", this.scene);
    stone.diffuseColor = new Color3(0.45, 0.4, 0.32);
    stone.specularColor = new Color3(0.04, 0.04, 0.04);

    const frame = MeshBuilder.CreateBox("doorFrame", { width: 4.2, height: 4.5, depth: 1.2 }, this.scene);
    frame.position.set(4.2, 2.25, 0);
    frame.material = stone;
    frame.checkCollisions = true;

    this.doorSlab = MeshBuilder.CreateBox("doorSlab", { width: 3.0, height: 3.6, depth: 0.5 }, this.scene);
    this.doorSlab.position.set(3.6, 1.9, 0);
    this.doorSlab.material = stone;
    this.doorSlab.checkCollisions = true;

    const mechMat = new StandardMaterial("mech", this.scene);
    mechMat.diffuseColor = new Color3(0.6, 0.5, 0.3);
    mechMat.emissiveColor = new Color3(0.1, 0.08, 0.02);

    const mech = MeshBuilder.CreateCylinder("doorMech", { height: 0.25, diameter: 1.4, tessellation: 20 }, this.scene);
    mech.rotation.x = Math.PI / 2;
    mech.position.set(3.3, 2.2, 0);
    mech.material = mechMat;
    mech.isPickable = true;

    this.doorMesh = mech;

    this.enterZone = MeshBuilder.CreateBox("enterZone", { width: 3, height: 3, depth: 2 }, this.scene);
    this.enterZone.position.set(5.5, 1.5, 0);
    this.enterZone.visibility = 0;
    this.enterZone.isPickable = true;
    this.enterZone.checkCollisions = false;
  }
}