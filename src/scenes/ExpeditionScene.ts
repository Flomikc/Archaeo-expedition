import {
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Ray,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

import { Anomaly } from "../entities/Anomaly";
import { CameraItem } from "../entities/CameraItem";
import { Drill } from "../entities/Drill";
import { Player } from "../entities/Player";
import { Atmosphere } from "../systems/Atmosphere";
import { InteractionSystem } from "../systems/InteractionSystem";
import { Cell, LevelData, LevelGenerator } from "../systems/LevelGenerator";
import { SaveSystem } from "../systems/SaveSystem";
import { HUD } from "../ui/HUD";

export interface ExpeditionSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  onReturnToHub: () => void;
  onRestart: () => void;
}

const MISSION_TIME = 420; // 7 минут (больше этажей)
const SPAWN_INTERVAL = 25;
const MAX_ANOMALIES = 4;
const PHOTO_RANGE = 12;
const START_PHOTOS = 8;

export class ExpeditionScene {
  readonly scene: Scene;

  private readonly options: ExpeditionSceneOptions;
  private readonly hud: HUD;
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;

  private readonly level: LevelData;
  private readonly player: Player;
  private readonly drill: Drill;
  private readonly interaction: InteractionSystem;
  private readonly exitMarker: Mesh;
  private readonly atmosphere: Atmosphere;
  private cameraItem: CameraItem | null = null;

  private anomalies: Anomaly[] = [];
  private torches: PointLight[] = [];

  private hp = 100;
  private photos = START_PHOTOS;
  private timeLeft = MISSION_TIME;
  private spawnTimer = 0;
  private shotCooldown = 0;
  private drillCompleted = false;
  private finished = false;
  private hasCamera = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.finished) return;
    if (e.code === "KeyE") {
      this.interaction.interact();
    } else if (e.code === "KeyF") {
      if (!this.hasCamera) {
        this.hud.showToast("Нет фотоаппарата!");
        return;
      }
      if (this.shotCooldown > 0) return;
      this.shotCooldown = 0.35;
      this.takePhoto();
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.finished || e.button !== 0) return;
    if (!this.hasCamera) return;
    if (this.shotCooldown > 0) return;
    this.shotCooldown = 0.35;
    this.takePhoto();
  };

  setEnabled(value: boolean): void {
    this.player.setEnabled(value);
  }

  shouldSuppressPause(): boolean {
    return this.finished;
  }

  constructor(options: ExpeditionSceneOptions) {
    this.options = options;
    this.hud = options.hud;
    this.canvas = options.canvas;
    this.engine = options.engine;

    this.scene = new Scene(options.engine);
    this.scene.clearColor = new Color4(0.015, 0.015, 0.02, 1);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    this.atmosphere.apply("pyramid");

    const ambient = new HemisphericLight("expAmbient", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.12;
    ambient.diffuse = new Color3(0.4, 0.35, 0.28);
    ambient.groundColor = new Color3(0.05, 0.04, 0.03);

    const save = SaveSystem.get();
    const seed = save.levelSeed ?? (Date.now() & 0xffffffff);
    SaveSystem.setLevelSeed(seed);

    this.level = new LevelGenerator().build(this.scene, seed);

    this.player = new Player({
      scene: this.scene,
      canvas: this.canvas,
      position: this.level.cellCenter(this.level.start).add(new Vector3(0, 1.7, 0)),
    });
    this.player.enableFlashlight();

    this.hasCamera = save.hasCamera;
    if (this.hasCamera) {
      this.cameraItem = new CameraItem(this.scene, new Vector3(0, -10, 0));
      this.cameraItem.pickup(this.player.camera);
    }

    const goalCenter = this.level.cellCenter(this.level.goal);
    this.drill = new Drill(
      this.scene,
      goalCenter.add(new Vector3(0, -3.5, 0)) // на дне ямы (4 м вниз + 0.5 высоты бура)
    );

    this.exitMarker = this.createExitMarker(this.level.cellCenter(this.level.start));
    this.exitMarker.setEnabled(false);

    this.placeTorches();

    this.interaction = new InteractionSystem(this.scene, this.player.camera);
    this.interaction.register({
      mesh: this.drill.interactionMesh,
      hint: "E — начать раскопки",
      range: 5,
      enabled: () => !this.drill.isActive && !this.drill.isComplete && !this.finished,
      onInteract: () => this.startDrilling(),
    });
    this.interaction.register({
      mesh: this.exitMarker,
      hint: "E — вернуться наружу",
      range: 5,
      enabled: () => this.drill.isComplete && !this.finished,
      onInteract: () => this.finishMission(true),
    });

    this.hud.setHudMode("expedition");
    this.hud.showHud(true);
    this.hud.setHp(this.hp);
    this.hud.setPhotos(this.photos);
    this.hud.setTimer(this.timeLeft);
    this.hud.setDrillProgress(false, 0);
    this.hud.setHint(null);

    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  update(dt: number): void {
    if (this.finished) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.hud.setTimer(0);
      this.finishMission(false);
      return;
    }
    this.hud.setTimer(this.timeLeft);

    if (this.shotCooldown > 0) this.shotCooldown -= dt;

    this.player.update(dt);
    this.cameraItem?.update(dt);
    this.interaction.update();
    this.hud.setHint(this.interaction.getHint());
    this.atmosphere.update(dt);

    this.drill.update(dt);
    if (this.drill.isActive) {
      this.hud.setDrillProgress(true, this.drill.progress);
      if (this.drill.isComplete && !this.drillCompleted) {
        this.drillCompleted = true;
        this.onDrillComplete();
      }
    }

    if (this.drill.isActive && !this.drill.isComplete) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.anomalies.length < MAX_ANOMALIES) {
        this.spawnAnomaly();
        this.spawnTimer = SPAWN_INTERVAL;
      }
    }

    // Факелы мигают
    const t = performance.now() / 1000;
    for (let i = 0; i < this.torches.length; i++) {
      this.torches[i].intensity = 0.55 + Math.sin(t * 3.1 + i * 1.7) * 0.18;
    }

    // Ловушки: если игрок ниже пола комнаты trap — урон
    this.checkTrapDamage(dt);

    const playerPosition = this.player.camera.position;
    for (const anomaly of [...this.anomalies]) {
      const damage = anomaly.update(dt, playerPosition);
      if (damage > 0) {
        this.hp = Math.max(0, this.hp - damage);
        this.hud.setHp(this.hp);
        this.hud.showToast("Аномалия атакует! −10 HP");
        if (this.hp <= 0) {
          this.finishMission(false);
          return;
        }
      }
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];
    this.cameraItem?.dispose();
    this.atmosphere.dispose();
    this.player.dispose();
    this.scene.dispose();
  }

  private placeTorches(): void {
    const mat = new StandardMaterial("torchMat", this.scene);
    mat.diffuseColor = new Color3(0.3, 0.15, 0.05);
    mat.emissiveColor = new Color3(0.6, 0.3, 0.05);

    for (let f = 0; f < this.level.floors; f++) {
      for (let n = 0; n < 3; n++) {
        const i = Math.floor(Math.random() * this.level.size);
        const j = Math.floor(Math.random() * this.level.size);
        const center = this.level.cellCenter({ i, j, floor: f });
        const light = new PointLight(`torch${f}_${n}`, center.add(new Vector3(0, 2.5, 0)), this.scene);
        light.diffuse = new Color3(1, 0.55, 0.2);
        light.intensity = 0.6;
        light.range = 10;
        this.torches.push(light);

        const flame = MeshBuilder.CreateSphere(`flame${f}_${n}`, { diameter: 0.25 }, this.scene);
        flame.position = center.add(new Vector3(0, 2.5, 0));
        flame.material = mat;
        flame.isPickable = false;
      }
    }
  }

  private checkTrapDamage(dt: number): void {
    const pos = this.player.camera.position;
    for (const [, room] of this.level.rooms) {
      if (room.type !== "trap") continue;
      const c = this.level.cellCenter(room.cell);
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      if (Math.abs(dx) < 2.5 && Math.abs(dz) < 2.5 && pos.y < c.y + 1.2) {
        // На шипах
        this.hp = Math.max(0, this.hp - 8 * dt);
        this.hud.setHp(this.hp);
        if (this.hp <= 0) this.finishMission(false);
      }
    }
  }

  private createExitMarker(position: Vector3): Mesh {
    const marker = MeshBuilder.CreateCylinder(
      "exitMarker",
      { height: 4, diameter: 1.3, tessellation: 18 },
      this.scene
    );
    marker.position = position.add(new Vector3(0, 2, 0));
    const mat = new StandardMaterial("exitMat", this.scene);
    mat.diffuseColor = new Color3(0.9, 0.12, 0.12);
    mat.emissiveColor = new Color3(0.55, 0.05, 0.05);
    mat.alpha = 0.65;
    marker.material = mat;
    marker.isPickable = true;
    marker.checkCollisions = false;
    return marker;
  }

  private startDrilling(): void {
    this.drill.activate();
    this.spawnTimer = 0;
    this.hud.setDrillProgress(true, 0);
    this.hud.showToast("Бур запущен! Защищайте раскопки.", 3500);
  }

  private onDrillComplete(): void {
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];
    this.exitMarker.setEnabled(true);
    this.hud.setDrillProgress(false, 0);
    this.hud.showToast("Артефакт найден! Вернитесь ко входу.", 6000);
  }

  private spawnAnomaly(): void {
    const playerPosition = this.player.camera.position;
    let cell: Cell = this.level.goal;
    for (let attempt = 0; attempt < 24; attempt++) {
      cell = {
        i: Math.floor(Math.random() * this.level.size),
        j: Math.floor(Math.random() * this.level.size),
        floor: Math.floor(Math.random() * this.level.floors),
      };
      const center = this.level.cellCenter(cell);
      const dx = center.x - playerPosition.x;
      const dz = center.z - playerPosition.z;
      const dy = center.y - playerPosition.y;
      if (Math.sqrt(dx * dx + dz * dz + dy * dy) > 18) break;
    }
    const center = this.level.cellCenter(cell);
    const position = center.add(
      new Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)
    );
    this.anomalies.push(
      new Anomaly({
        scene: this.scene,
        position,
        pickPatrolPoint: () => this.pickPatrolPoint(),
      })
    );
  }

  private pickPatrolPoint(): Vector3 {
    const i = Math.floor(Math.random() * this.level.size);
    const j = Math.floor(Math.random() * this.level.size);
    const floor = Math.floor(Math.random() * this.level.floors);
    const center = this.level.cellCenter({ i, j, floor });
    return center.add(new Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
  }

  private takePhoto(): void {
    if (this.photos <= 0) {
      this.hud.showToast("Плёнка закончилась!");
      return;
    }
    this.photos -= 1;
    this.hud.setPhotos(this.photos);
    this.cameraItem?.shootKick();

    const target = this.findAnomalyInSight();
    if (target) {
      target.dispose();
      this.anomalies = this.anomalies.filter((a) => a !== target);
      this.hud.showToast("Аномалия запечатлена!");
    } else {
      this.hud.showToast("Промах…");
    }
  }

  private findAnomalyInSight(): Anomaly | null {
    if (this.anomalies.length === 0) return null;
    const origin = this.player.camera.position.clone();
    const direction = this.player.camera.getDirection(Vector3.Forward());

    const ray = new Ray(origin, direction, PHOTO_RANGE);
    const anomalyMeshes = new Set(this.anomalies.flatMap((a) => a.meshes));
    const pick = this.scene.pickWithRay(ray, (mesh) => anomalyMeshes.has(mesh));
    if (pick && pick.hit && pick.pickedMesh) {
      const hit = this.anomalies.find((a) => a.meshes.includes(pick.pickedMesh!));
      if (hit) return hit;
    }

    const cosLimit = Math.cos(0.35);
    let best: Anomaly | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const anomaly of this.anomalies) {
      const toAnomaly = anomaly.root.position.add(new Vector3(0, 1, 0)).subtract(origin);
      const distance = toAnomaly.length();
      if (distance > PHOTO_RANGE || distance < 0.001) continue;
      toAnomaly.normalize();
      if (Vector3.Dot(toAnomaly, direction) < cosLimit) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = anomaly;
      }
    }
    return best;
  }

  private finishMission(success: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.player.setEnabled(false);
    this.engine.exitPointerlock();
    this.hud.setHint(null);
    this.hud.setDrillProgress(false, 0);
    for (const anomaly of this.anomalies) anomaly.dispose();
    this.anomalies = [];

    const spent = Math.max(0, MISSION_TIME - this.timeLeft);

    if (success) {
      SaveSystem.addCoins(100);
      this.hud.showResult(
        "Вердикт миссии",
        [
          "Статус: успех",
          `Время экспедиции: ${this.formatDuration(spent)}`,
          `Осталось снимков: ${this.photos}`,
          `Здоровье: ${Math.round(this.hp)}%`,
          "Награда: 100 монет",
        ],
        [{ label: "Вернуться в фуру", primary: true, action: () => this.options.onReturnToHub() }]
      );
    } else {
      const reason = this.hp <= 0 ? "Вы потеряли сознание" : "Время вышло";
      this.hud.showResult(
        "Провал",
        [
          `Причина: ${reason}`,
          `Время в пирамиде: ${this.formatDuration(spent)}`,
          `Осталось снимков: ${this.photos}`,
        ],
        [
          { label: "Повторить", primary: true, action: () => this.options.onRestart() },
          { label: "Вернуться в фуру", action: () => this.options.onReturnToHub() },
        ]
      );
    }
  }

  private formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
