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
import { Atmosphere } from "../systems/Atmosphere";
import { InteractionSystem } from "../systems/InteractionSystem";
import { LockpickSystem } from "../systems/LockpickSystem";
import { HUD } from "../ui/HUD";

export interface DesertSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  onEnterPyramid: () => void;
  onReturnToHub: () => void;
}

/**
 * Пустыня: фура, пирамида, дорожка, каменная дверь с круговым взломом.
 */
export class DesertScene {
  readonly scene: Scene;

  private readonly options: DesertSceneOptions;
  private readonly hud: HUD;
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

    this.scene = new Scene(options.engine);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    this.atmosphere.apply("desert");

    // Солнце
    const sun = new DirectionalLight("sun", new Vector3(-0.4, -0.85, 0.3), this.scene);
    sun.intensity = 1.35;
    sun.diffuse = new Color3(1, 0.92, 0.75);
    sun.specular = new Color3(0.4, 0.35, 0.25);

    const ambient = new HemisphericLight("desertAmb", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.35;
    ambient.diffuse = new Color3(0.9, 0.75, 0.55);
    ambient.groundColor = new Color3(0.35, 0.28, 0.18);

    this.buildGround();
    this.buildTruck();
    this.buildPyramid();
    this.buildPath();
    this.buildDoor();

    this.player = new Player({
      scene: this.scene,
      canvas: options.canvas,
      position: new Vector3(-8, 1.7, 2),
      speed: 4.2,
    });
    this.player.camera.rotation.y = -0.4;

    this.interaction = new InteractionSystem(this.scene, this.player.camera);
    this.interaction.register({
      mesh: this.doorMesh,
      hint: "E — взломать замок",
      range: 4.5,
      enabled: () => !this.doorUnlocked && !this.lockpick.isOpen(),
      onInteract: () => this.startLockpick(),
    });
    this.interaction.register({
      mesh: this.enterZone,
      hint: "E — войти в пирамиду",
      range: 4,
      enabled: () => this.doorUnlocked,
      onInteract: () => this.options.onEnterPyramid(),
    });

    // Дверь фуры — вернуться
    const truckDoor = MeshBuilder.CreateBox("truckDoorBack", { width: 1.4, height: 2.2, depth: 0.3 }, this.scene);
    truckDoor.position.set(-12, 1.2, 0);
    truckDoor.visibility = 0;
    truckDoor.isPickable = true;
    truckDoor.checkCollisions = false;
    this.interaction.register({
      mesh: truckDoor,
      hint: "E — вернуться в фуру",
      range: 3.5,
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

  // ---------------------------------------------------------------- build

  private buildGround(): void {
    const ground = MeshBuilder.CreateGround("sand", { width: 120, height: 120, subdivisions: 32 }, this.scene);
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

  private buildTruck(): void {
    const mat = new StandardMaterial("truckExt", this.scene);
    mat.diffuseColor = new Color3(0.22, 0.23, 0.25);
    mat.specularColor = new Color3(0.08, 0.08, 0.08);

    const body = MeshBuilder.CreateBox("extTruck", { width: 6, height: 3, depth: 3 }, this.scene);
    body.position.set(-12, 1.5, 0);
    body.material = mat;
    body.checkCollisions = true;

    const cabin = MeshBuilder.CreateBox("extCabin", { width: 2.2, height: 2.4, depth: 2.8 }, this.scene);
    cabin.position.set(-8.2, 1.4, 0);
    cabin.material = mat;
    cabin.checkCollisions = true;

    const wheelMat = new StandardMaterial("wheel", this.scene);
    wheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
    for (const [x, z] of [
      [-14, 1.3],
      [-14, -1.3],
      [-10, 1.3],
      [-10, -1.3],
    ]) {
      const w = MeshBuilder.CreateCylinder("wheel", { height: 0.4, diameter: 1.1, tessellation: 12 }, this.scene);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.55, z);
      w.material = wheelMat;
    }
  }

  private buildPyramid(): void {
    const mat = new StandardMaterial("pyrExt", this.scene);
    mat.diffuseColor = new Color3(0.8, 0.7, 0.5);
    mat.specularColor = new Color3(0.05, 0.05, 0.04);
    mat.ambientColor = new Color3(0.25, 0.2, 0.12);

    // Пирамида из 4 уровней (усечённые «ступени»)
    const levels = [
      { y: 1.5, s: 28 },
      { y: 5, s: 20 },
      { y: 8.5, s: 12 },
      { y: 11.5, s: 5 },
    ];
    for (const lv of levels) {
      const box = MeshBuilder.CreateBox(`pyrLv`, { width: lv.s, height: 3.2, depth: lv.s }, this.scene);
      box.position.set(18, lv.y, 0);
      box.material = mat;
      box.checkCollisions = true;
    }

    // Вход — чёрный проём
    const entrance = MeshBuilder.CreateBox("pyrEntrance", { width: 3.2, height: 3.5, depth: 4 }, this.scene);
    entrance.position.set(5.5, 1.75, 0);
    const dark = new StandardMaterial("entranceDark", this.scene);
    dark.diffuseColor = new Color3(0.02, 0.02, 0.03);
    dark.emissiveColor = new Color3(0.01, 0.01, 0.015);
    entrance.material = dark;
    entrance.checkCollisions = false;
  }

  private buildPath(): void {
    const stone = new StandardMaterial("pathStone", this.scene);
    stone.diffuseColor = new Color3(0.55, 0.5, 0.4);
    stone.specularColor = Color3.Black();

    for (let i = 0; i < 14; i++) {
      const x = -6 + i * 1.1;
      const slab = MeshBuilder.CreateBox(`path${i}`, { width: 1.0, height: 0.12, depth: 1.6 }, this.scene);
      slab.position.set(x, 0.06, (Math.random() - 0.5) * 0.4);
      slab.rotation.y = (Math.random() - 0.5) * 0.15;
      slab.material = stone;
      slab.checkCollisions = false;
    }
  }

  private buildDoor(): void {
    const stone = new StandardMaterial("doorStone", this.scene);
    stone.diffuseColor = new Color3(0.45, 0.4, 0.32);
    stone.specularColor = new Color3(0.04, 0.04, 0.04);

    // Рама
    const frame = MeshBuilder.CreateBox("doorFrame", { width: 4.2, height: 4.5, depth: 1.2 }, this.scene);
    frame.position.set(4.2, 2.25, 0);
    frame.material = stone;
    frame.checkCollisions = true;

    // Подвижная плита
    this.doorSlab = MeshBuilder.CreateBox("doorSlab", { width: 3.0, height: 3.6, depth: 0.5 }, this.scene);
    this.doorSlab.position.set(3.6, 1.9, 0);
    this.doorSlab.material = stone;
    this.doorSlab.checkCollisions = true;

    // Круглый механизм
    const mechMat = new StandardMaterial("mech", this.scene);
    mechMat.diffuseColor = new Color3(0.6, 0.5, 0.3);
    mechMat.emissiveColor = new Color3(0.1, 0.08, 0.02);
    const mech = MeshBuilder.CreateCylinder("doorMech", { height: 0.25, diameter: 1.4, tessellation: 20 }, this.scene);
    mech.rotation.x = Math.PI / 2;
    mech.position.set(3.3, 2.2, 0);
    mech.material = mechMat;
    mech.isPickable = true;

    this.doorMesh = mech;

    // Зона входа после открытия
    this.enterZone = MeshBuilder.CreateBox("enterZone", { width: 3, height: 3, depth: 2 }, this.scene);
    this.enterZone.position.set(5.5, 1.5, 0);
    this.enterZone.visibility = 0;
    this.enterZone.isPickable = true;
    this.enterZone.checkCollisions = false;
  }

  private async startLockpick(): Promise<void> {
    if (this.doorUnlocked || this.lockpick.isOpen()) return;
    this.menuOpen = true;
    this.player.setEnabled(false);
    this.options.engine.exitPointerlock();
    this.hud.setHint(null);

    const result = await this.lockpick.start(() => {
      this.menuOpen = false;
      this.player.setEnabled(true);
      this.options.engine.enterPointerlock();
      this.options.onReturnToHub();
    });

    this.menuOpen = false;

    if (result.success) {
      this.doorUnlocked = true;
      this.animateDoorOpen();
      this.hud.showToast("Дверь открыта!", 3000);
      this.player.setEnabled(true);
      this.options.engine.enterPointerlock();
    } else {
      // abort уже вызвал onReturnToHub
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
}
