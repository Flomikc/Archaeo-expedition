import {
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import { CameraItem } from "../entities/CameraItem";
import { Player } from "../entities/Player";
import { ArtifactSystem } from "../systems/ArtifactSystem";
import { Atmosphere } from "../systems/Atmosphere";
import { InteractionSystem } from "../systems/InteractionSystem";
import { LaptopSystem } from "../systems/LaptopSystem";
import { SaveSystem } from "../systems/SaveSystem";
import { ShopSystem } from "../systems/ShopSystem";
import { WorkbenchSystem } from "../systems/WorkbenchSystem";
import { SHOP_ITEMS } from "../data/ShopData";
import { HUD } from "../ui/HUD";

export interface HubSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  /** Игрок выбрал локацию «Египет» в ноутбуке → отправляемся в пустыню. */
  onGoToDesert: () => void;
}

export class HubScene {
  readonly scene: Scene;

  private readonly options: HubSceneOptions;
  private readonly hud: HUD;
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;

  private readonly player: Player;
  private readonly interaction: InteractionSystem;
  private readonly atmosphere: Atmosphere;
  private readonly laptopSystem: LaptopSystem;
  private readonly workbench = new WorkbenchSystem();

  private cameraItem: CameraItem | null = null;
  private laptopOpen = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Пока открыт верстак — вообще ничего не делаем
    if (this.workbench.isOpen()) return;

    // Ноутбук
    if (this.laptopOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        void this.closeLaptop();
      }
      return;
    }

    if (this.laptopSystem.isBusy) return;
    if (e.code === "KeyE") this.interaction.interact();
  };

  constructor(options: HubSceneOptions) {
    this.options = options;
    this.hud = options.hud;
    this.canvas = options.canvas;
    this.engine = options.engine;

    this.scene = new Scene(options.engine);
    this.scene.clearColor = new Color4(0.02, 0.02, 0.025, 1);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    this.atmosphere.apply("hub");

    const ambient = new HemisphericLight("hubAmbient", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.45;
    ambient.diffuse = new Color3(0.9, 0.85, 0.8);
    ambient.groundColor = new Color3(0.18, 0.18, 0.22);

    const lamp = new PointLight("hubLamp", new Vector3(0, 2.7, 0), this.scene);
    lamp.intensity = 0.7;
    lamp.diffuse = new Color3(1, 0.95, 0.85);
    lamp.range = 14;

    this.buildTruck();
    const exitDoorTrigger = MeshBuilder.CreateBox(
      "hubExitTrigger",
      { width: 2, height: 2.4, depth: 0.6 },
      this.scene
    );
    exitDoorTrigger.position.set(4.2, 1.2, 0);
    exitDoorTrigger.visibility = 0;
    exitDoorTrigger.isPickable = true;
    exitDoorTrigger.checkCollisions = false;

    const laptopTrigger = this.buildFurniture();

    this.player = new Player({
      scene: this.scene,
      canvas: this.canvas,
      position: new Vector3(-1.2, 1.7, 0),
    });
    this.player.camera.rotation.y = Math.PI / 2;

    // Фотоаппарат (world-модель на столе, если ещё не взят)
    const save = SaveSystem.get();
    if (!save.hasCamera) {
      this.cameraItem = new CameraItem(this.scene, new Vector3(-3, 1.05, 0.35));
    } else {
      this.cameraItem = new CameraItem(this.scene, new Vector3(0, -10, 0));
      this.cameraItem.pickup(this.player.camera);
    }

    this.laptopSystem = new LaptopSystem({
      scene: this.scene,
      canvas: this.canvas,
      player: this.player,
      screenPosition: new Vector3(-2.45, 1.30, -0.30),
      screenLookAt: new Vector3(-3.19, 1.20, -0.30),
      flightDuration: 0.75,
    });

    // === Сначала создаём interaction, потом регистрируем всё ===
    this.interaction = new InteractionSystem(this.scene, this.player.camera);

    // --- Дверь наружу ---
    this.interaction.register({
      mesh: exitDoorTrigger,
      hint: "E — выйти из фуры",
      range: 3,
      enabled: () =>
        !this.laptopOpen && !this.laptopSystem.isBusy && !this.workbench.isOpen(),
      onInteract: () => this.options.onGoToDesert(),
    });

    // --- Ноутбук ---
    this.interaction.register({
      mesh: laptopTrigger,
      hint: "E — открыть ноутбук",
      range: 3.5,
      enabled: () =>
        !this.laptopOpen && !this.laptopSystem.isBusy && !this.workbench.isOpen(),
      onInteract: () => void this.openLaptop(),
    });

    // --- Верстак ---
    const benchMesh = this.scene.getMeshByName("benchTop");
    if (benchMesh) {
      this.interaction.register({
        mesh: benchMesh,
        hint: "E — верстак",
        range: 3,
        enabled: () =>
          !this.laptopOpen && !this.laptopSystem.isBusy && !this.workbench.isOpen(),
        onInteract: () => void this.openWorkbench(),
      });
    }

    // --- Фотоаппарат ---
    if (this.cameraItem && !save.hasCamera) {
      this.interaction.register({
        mesh: this.cameraItem.interactionMesh,
        hint: "E — взять фотоаппарат",
        range: 2.5,
        enabled: () =>
          !this.cameraItem!.isOwned && !this.laptopOpen && !this.workbench.isOpen(),
        onInteract: () => this.pickupCamera(),
      });
    }

    // ================================================================
    // HUD-хуки
    // ================================================================

    this.hud.setLaptopHandlers({
      onClose: () => void this.closeLaptop(),
      onSelectLocation: (id) => this.onLocationSelected(id),
      onBuyItem: (id) => this.onBuyItem(id),
    });

    this.hud.setArtifactHandlers({
      onRestore: (index) => void this.restoreArtifact(index),
      onSell: (index) => this.sellArtifact(index),
      onMerge: (indices) => this.mergeArtifacts(indices[0]),
    });

    this.hud.setHudMode("hub");
    this.hud.showHud(true);
    this.hud.setHint(null);

    window.addEventListener("keydown", this.onKeyDown);
  }

  // --------------------------------------------------------------- public

  update(dt: number): void {
    if (this.laptopOpen || this.laptopSystem.isBusy || this.workbench.isOpen()) return;
    this.player.update(dt);
    this.cameraItem?.update(dt);
    this.interaction.update();
    this.hud.setHint(this.interaction.getHint());
  }

  setEnabled(value: boolean): void {
    this.player.setEnabled(value);
  }

  shouldSuppressPause(): boolean {
    return (
      this.laptopOpen ||
      this.laptopSystem.isActive ||
      this.laptopSystem.isBusy ||
      this.workbench.isOpen()
    );
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.cameraItem?.dispose();
    this.atmosphere.dispose();
    this.player.dispose();
    this.scene.dispose();
  }

  // -------------------------------------------------------------- laptop

  private async openLaptop(): Promise<void> {
    if (this.laptopOpen || this.laptopSystem.isBusy) return;
    this.laptopOpen = true;
    this.hud.setHint(null);
    await this.laptopSystem.open();
    this.refreshLaptopUI();
    this.hud.showLaptop(SaveSystem.get().coins);
  }

  private async closeLaptop(): Promise<void> {
    if (!this.laptopOpen) return;
    this.laptopOpen = false;
    this.hud.hideLaptop();

    // ВАЖНО: захватываем pointer lock синхронно, пока мы всё ещё
    // в контексте пользовательского клика — иначе браузер откажет.
    this.engine.enterPointerlock();

    await this.laptopSystem.close();
  }

  private refreshLaptopUI(): void {
    const coins = SaveSystem.get().coins;
    this.hud.setLaptopCoins(coins);

    this.hud.renderShop(
      SHOP_ITEMS.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        owned: ShopSystem.ownedCount(item.id),
        maxStack: item.maxStack,
        unique: item.unique,
      }))
    );

    this.hud.renderInventory(SaveSystem.get().artifacts);
  }

  private onBuyItem(id: string): void {
    const result = ShopSystem.buy(id);
    if (!result.ok) {
      this.hud.showToast(result.reason ?? "Не удалось купить", 2200);
      return;
    }
    this.hud.showToast("Куплено", 1500);
    this.refreshLaptopUI();
  }

  private onLocationSelected(id: string): void {
    if (id !== "egypt") return;
    void this.leaveToDesert();
  }

  private async leaveToDesert(): Promise<void> {
    await this.closeLaptop();
    this.options.onGoToDesert();
  }

  // ------------------------------------------------------------ workbench

  private async openWorkbench(): Promise<void> {
    if (this.workbench.isOpen()) return;

    // Находим первый неотреставрированный артефакт
    const artifacts = SaveSystem.get().artifacts;
    let index = -1;
    for (let i = 0; i < artifacts.length; i++) {
      if (!artifacts[i].restored) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      this.hud.showToast("Нет артефактов для реставрации. Сначала в экспедицию.", 3200);
      return;
    }

    this.player.setEnabled(false);
    this.hud.setHint(null);
    this.engine.enterPointerlock();

    const result = await this.workbench.start(index);

    this.player.setEnabled(true);
    this.engine.enterPointerlock();

    if (result.action === "restore" && typeof result.quality === "number") {
      SaveSystem.updateArtifact(index, {
        restored: true,
        quality: result.quality,
      });
      this.hud.showToast(
        `Артефакт отреставрирован: ${Math.round(result.quality * 100)}%`,
        2500
      );
    }
  }

  private async restoreArtifact(index: number): Promise<void> {
    const wasLaptopOpen = this.laptopOpen;
    if (wasLaptopOpen) this.hud.hideLaptop();

    // Синхронный захват pointer lock до запуска мини-игры.
    this.engine.enterPointerlock();

    const result = await this.workbench.start(index);

    if (result.action === "restore" && typeof result.quality === "number") {
      SaveSystem.updateArtifact(index, {
        restored: true,
        quality: result.quality,
      });
      this.hud.showToast(
        `Артефакт отреставрирован: ${Math.round(result.quality * 100)}%`,
        2500
      );
    }

    if (wasLaptopOpen) {
      this.refreshLaptopUI();
      this.hud.showLaptop(SaveSystem.get().coins);
    } else {
      // Если мини-игра запускалась с верстака, вернуть управление игроку
      this.player.setEnabled(true);
      this.engine.enterPointerlock();
    }
  }

  private sellArtifact(index: number): void {
    const price = ArtifactSystem.sell(index);
    if (price <= 0) {
      this.hud.showToast("Нечего продавать", 1800);
      return;
    }
    this.hud.showToast(`Продано за ${price} монет`, 2000);
    this.refreshLaptopUI();
  }

  private mergeArtifacts(baseIndex: number): void {
    const result = ArtifactSystem.mergeFirstOfKind(baseIndex);
    if (!result.ok) {
      this.hud.showToast(result.reason, 2200);
      return;
    }
    this.hud.showToast("Слияние успешно! Требуется реставрация.", 2500);
    this.refreshLaptopUI();
  }

  // ---------------------------------------------------------------- build

  private pickupCamera(): void {
    if (!this.cameraItem || this.cameraItem.isOwned) return;
    this.cameraItem.pickup(this.player.camera);
    SaveSystem.setHasCamera(true);
    this.hud.showToast("Фотоаппарат получен", 2500);
  }

  private buildTruck(): void {
    const wallMat = new StandardMaterial("truckWall", this.scene);
    wallMat.diffuseColor = new Color3(0.16, 0.16, 0.18);
    wallMat.specularColor = new Color3(0.05, 0.05, 0.05);
    wallMat.emissiveColor = new Color3(0.03, 0.03, 0.035);

    const floorMat = new StandardMaterial("truckFloor", this.scene);
    floorMat.diffuseColor = new Color3(0.12, 0.1, 0.09);
    floorMat.specularColor = Color3.Black();

    const ceilingMat = new StandardMaterial("truckCeiling", this.scene);
    ceilingMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
    ceilingMat.specularColor = Color3.Black();

    const length = 8.4;
    const height = 3.2;
    const width = 4.4;
    const thickness = 0.2;

    const add = (
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: StandardMaterial,
      collide: boolean
    ): Mesh => {
      const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
      box.position.set(x, y, z);
      box.material = mat;
      box.checkCollisions = collide;
      box.isPickable = false;
      return box;
    };

    add("truckFloor", length, thickness, width, 0, -thickness / 2, 0, floorMat, true);
    add("truckCeiling", length, thickness, width, 0, height + thickness / 2, 0, ceilingMat, true);
    add("truckWallBack", length, height, thickness, 0, height / 2, -width / 2 - thickness / 2, wallMat, true);
    add("truckWallFront", length, height, thickness, 0, height / 2, width / 2 + thickness / 2, wallMat, true);
    add("truckWallLeft", thickness, height, width, -length / 2 - thickness / 2, height / 2, 0, wallMat, true);
    add("truckWallRight", thickness, height, width, length / 2 + thickness / 2, height / 2, 0, wallMat, true);
  }

  private buildFurniture(): Mesh {
    const wood = new StandardMaterial("hubWood", this.scene);
    wood.diffuseColor = new Color3(0.36, 0.24, 0.14);
    wood.specularColor = new Color3(0.05, 0.05, 0.05);

    const metal = new StandardMaterial("hubMetal", this.scene);
    metal.diffuseColor = new Color3(0.35, 0.36, 0.4);
    metal.specularColor = new Color3(0.3, 0.3, 0.3);

    const fabric = new StandardMaterial("hubFabric", this.scene);
    fabric.diffuseColor = new Color3(0.25, 0.3, 0.35);

    const screenMat = new StandardMaterial("hubScreen", this.scene);
    screenMat.diffuseColor = new Color3(0.02, 0.02, 0.03);
    screenMat.emissiveColor = new Color3(0.01, 0.01, 0.015);
    screenMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const box = (
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: StandardMaterial
    ): Mesh => {
      const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
      mesh.position.set(x, y, z);
      mesh.material = mat;
      mesh.checkCollisions = true;
      mesh.isPickable = false;
      return mesh;
    };

    // Стол с ноутбуком (западная стена фуры)
    box("tableTop", 1.6, 0.1, 1.6, -3, 0.95, 0, wood);
    box("tableLeg1", 0.1, 0.9, 0.1, -3.7, 0.45, -0.7, wood);
    box("tableLeg2", 0.1, 0.9, 0.1, -2.3, 0.45, -0.7, wood);
    box("tableLeg3", 0.1, 0.9, 0.1, -3.7, 0.45, 0.7, wood);
    box("tableLeg4", 0.1, 0.9, 0.1, -2.3, 0.45, 0.7, wood);

    box("laptopBase", 0.4, 0.04, 0.55, -3, 1.02, -0.3, metal);
    const screen = box("laptopScreen", 0.03, 0.36, 0.55, -3.19, 1.2, -0.3, screenMat);
    screen.checkCollisions = false;

    const trigger = MeshBuilder.CreateBox("laptopTrigger", { width: 1.2, height: 1.0, depth: 1.2 }, this.scene);
    trigger.position.set(-3, 1.35, -0.3);
    trigger.visibility = 0;
    trigger.isPickable = true;
    trigger.checkCollisions = false;

    // Верстак (восточная стена). Имя benchTop — по нему регистрируется взаимодействие.
    const benchTop = box("benchTop", 2.4, 0.12, 0.9, 3, 0.9, -1.2, wood);
    benchTop.isPickable = true;  // ← важно: верстак кликабелен
    box("benchLeg1", 0.1, 0.85, 0.1, 1.9, 0.42, -1.55, metal);
    box("benchLeg2", 0.1, 0.85, 0.1, 4.1, 0.42, -1.55, metal);
    box("benchLeg3", 0.1, 0.85, 0.1, 1.9, 0.42, -0.85, metal);
    box("benchLeg4", 0.1, 0.85, 0.1, 4.1, 0.42, -0.85, metal);

    // Стеллаж
    box("shelfBoard1", 2.4, 0.08, 0.7, 3, 0.4, 1.2, wood);
    box("shelfBoard2", 2.4, 0.08, 0.7, 3, 1.0, 1.2, wood);
    box("shelfBoard3", 2.4, 0.08, 0.7, 3, 1.6, 1.2, wood);
    box("shelfSideL", 0.06, 1.7, 0.7, 1.83, 0.85, 1.2, wood);
    box("shelfSideR", 0.06, 1.7, 0.7, 4.17, 0.85, 1.2, wood);

    // Кровать
    box("bedFrame", 2.0, 0.2, 1.1, -3, 0.25, 1.4, wood);
    box("bedMattress", 1.8, 0.2, 1.0, -3, 0.5, 1.4, fabric);
    box("bedPillow", 0.45, 0.15, 0.7, -3.75, 0.62, 1.4, fabric);

    return trigger;
  }
}