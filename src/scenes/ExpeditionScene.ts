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
import { GridLevelData, GridLevelGenerator } from "../systems/GridLevelGenerator";
import { SaveSystem } from "../systems/SaveSystem";
import { ShopSystem } from "../systems/ShopSystem";
import { HUD } from "../ui/HUD";
import { rollArtifact } from "../data/ArtifactsData";

export interface ExpeditionSceneOptions {
  engine: Engine;
  canvas: HTMLCanvasElement;
  hud: HUD;
  onReturnToHub: () => void;
  onRestart: () => void;
}

const MISSION_TIME = 420;
const SPAWN_INTERVAL = 25;
const MAX_ANOMALIES = 4;
const PHOTO_RANGE = 12;
const START_PHOTOS = 8;
const PIT_DEPTH = 3.0;
const PLAYER_EYE_HEIGHT = 1.7;

export class ExpeditionScene {
  readonly scene: Scene;

  private readonly options: ExpeditionSceneOptions;
  private readonly hud: HUD;
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;

  private readonly level: GridLevelData;
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
  private medkits = 0;
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
      this.tryPhoto();
    } else if (e.code === "KeyH") {
      this.tryMedkit();
    } else if (e.code === "KeyL") {
      this.player.toggleFlashlight();
      this.hud.showToast(
        this.player.isFlashlightOn() ? "Фонарик включён" : "Фонарик выключен",
        1200
      );
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.finished || e.button !== 0) return;
    this.tryPhoto();
  };

  constructor(options: ExpeditionSceneOptions) {
    this.options = options;
    this.hud = options.hud;
    this.canvas = options.canvas;
    this.engine = options.engine;

    this.scene = new Scene(options.engine);
    this.scene.clearColor = new Color4(0.01, 0.01, 0.015, 1);
    this.scene.collisionsEnabled = true;

    this.atmosphere = new Atmosphere(this.scene);
    // ВРЕМЕННО: пирамида без тумана, без пост-обработки.
    this.atmosphere.apply("hub");   // ← используем лёгкий пресет как в фуре
    this.scene.fogMode = Scene.FOGMODE_NONE;

    const ambient = new HemisphericLight("expAmbient", new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.45;                        // как в фуре
    ambient.diffuse = new Color3(0.9, 0.85, 0.8);    // как в фуре
    ambient.groundColor = new Color3(0.18, 0.18, 0.22);

    const bonuses = ShopSystem.getRuntimeBonuses();
    this.hasCamera = SaveSystem.get().hasCamera;
    this.photos = START_PHOTOS + bonuses.startPhotosBonus;
    this.medkits = bonuses.medkitCount;

    // ── Генерация уровня ────────────────────────────────────
    const save = SaveSystem.get();
    const seed = save.levelSeed ?? (Date.now() & 0xffffffff);
    SaveSystem.setLevelSeed(seed);
    this.level = new GridLevelGenerator().build(this.scene, {
      size: "small",
      seed,
    });

    // ── Игрок ───────────────────────────────────────────────
    const startRoom = this.level.start;
    this.player = new Player({
      scene: this.scene,
      canvas: this.canvas,
      position: new Vector3(
        startRoom.centerX,
        startRoom.floorY + PLAYER_EYE_HEIGHT,
        startRoom.centerZ
      ),
    });
    this.player.enableFlashlight();
    this.hud.showToast("L — фонарик", 3000);

    // Лампа на игроке — как hubLamp в фуре.
    // Даёт постоянный свет вокруг игрока, чтобы стены всегда были видны.
    const playerLamp = new PointLight("expPlayerLamp", new Vector3(0, 2.7, 0), this.scene);
    playerLamp.intensity = 0.7;
    playerLamp.diffuse = new Color3(1, 0.95, 0.85);
    playerLamp.range = 14;
    // Привязываем к камере игрока, чтобы летела за ним
    playerLamp.parent = this.player.camera;
    playerLamp.position.set(0, 0.8, 0);

    // ── Камера-предмет ──────────────────────────────────────
    if (this.hasCamera) {
      this.cameraItem = new CameraItem(this.scene, new Vector3(0, -10, 0));
      this.cameraItem.pickup(this.player.camera);
    }

    // ── Бур (в goal-комнате, на дне ямы) ────────────────────
    const goalRoom = this.level.goal;
    this.drill = new Drill(
      this.scene,
      new Vector3(
        goalRoom.centerX,
        goalRoom.floorY - PIT_DEPTH + 0.5,
        goalRoom.centerZ
      ),
      bonuses.drillSpeedMultiplier
    );

    // ── Маркер выхода (в start-комнате) ─────────────────────
    this.exitMarker = this.createExitMarker(
      new Vector3(startRoom.centerX, startRoom.floorY, startRoom.centerZ)
    );
    this.exitMarker.setEnabled(false);

    // ── DEBUG: убираем все лишние источники света ────────────
    // Оставляем только ambient + фонарик.
    // Удаляем: drillMoon, drillFill (создаются в drill blueprint'е),
    // torch* (создаются в placeTorches), torchLight (в room-kit).
    // После проверки фонарика — верни как было.
    this.placeTorches();   // вызов оставим, но placeTorches() сам себя отключит

    // Удаляем все источники, кроме ambient и фонарика
    for (const light of [...this.scene.lights]) {
      if (light.name === "expAmbient") continue;
      if (light.name === "flashlight") continue;
      light.dispose();
    }
    console.log(
      "[DEBUG] Осталось источников:",
      this.scene.lights.map((l) => l.name)
    );

    // ── Интеракции ──────────────────────────────────────────
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

    // ── HUD ─────────────────────────────────────────────────
    this.hud.setHudMode("expedition");
    this.hud.showHud(true);
    this.hud.setHp(this.hp);
    this.hud.setPhotos(this.photos);
    this.hud.setTimer(this.timeLeft);
    this.hud.setDrillProgress(false, 0);
    this.hud.setHint(null);

    if (!this.hasCamera) {
      this.hud.showToast("Фотоаппарат не взят в фуре", 3500);
    }
    if (this.medkits > 0) {
      this.hud.showToast(`Аптечек: ${this.medkits} (клавиша H)`, 2500);
    }
// ── ВРЕМЕННО: дебаг из консоли ──────────────────────────────
(window as unknown as { __expDebug: unknown }).__expDebug = {
  scene: this.scene,
  player: this.player,
  flashlight: () => {
    const lights = this.scene.lights;
    return lights.map((l) => ({
      name: l.name,
      type: l.getClassName(),
      enabled: l.isEnabled(),
      intensity: "intensity" in l ? (l as { intensity: number }).intensity : null,
      range: "range" in l ? (l as { range: number }).range : null,
    }));
  },
};
    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  setEnabled(value: boolean): void {
    this.player.setEnabled(value);
  }

  shouldSuppressPause(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    if (this.finished) return;

    if (!this.updateTimer(dt)) return;

    if (this.shotCooldown > 0) this.shotCooldown -= dt;

    this.updatePlayer(dt);
    this.updateDrill(dt);
    this.updateAnomalies(dt);
    this.updateTorches();
    this.checkTrapDamage(dt);
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

  // ============================================================= update

  private updateTimer(dt: number): boolean {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.hud.setTimer(0);
      this.finishMission(false);
      return false;
    }
    this.hud.setTimer(this.timeLeft);
    return true;
  }

  private updatePlayer(dt: number): void {
    this.player.update(dt);
    this.cameraItem?.update(dt);
    this.interaction.update();
    this.hud.setHint(this.interaction.getHint());
    this.atmosphere.update(dt);
  }

  private updateDrill(dt: number): void {
    this.drill.update(dt);
    if (!this.drill.isActive) return;
    this.hud.setDrillProgress(true, this.drill.progress);
    if (this.drill.isComplete && !this.drillCompleted) {
      this.drillCompleted = true;
      this.onDrillComplete();
    }
  }

  private updateAnomalies(dt: number): void {
    if (this.drill.isActive && !this.drill.isComplete) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.anomalies.length < MAX_ANOMALIES) {
        this.spawnAnomaly();
        this.spawnTimer = SPAWN_INTERVAL;
      }
    }

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

  private updateTorches(): void {
    const t = performance.now() / 1000;
    for (let i = 0; i < this.torches.length; i++) {
      this.torches[i].intensity = 0.7 + Math.sin(t * 3.1 + i * 1.7) * 0.2;
    }
  }

  private checkTrapDamage(dt: number): void {
    const pos = this.player.camera.position;
    for (const room of this.level.rooms) {
      if (room.blueprint.category !== "trap") continue;

      // «Ловушка» срабатывает, только если игрок провалился в яму:
      // близко к центру комнаты и по Y ниже уровня пола.
      const dx = pos.x - room.centerX;
      const dz = pos.z - room.centerZ;
      const inX = Math.abs(dx) < room.sizeX / 2 - 1;
      const inZ = Math.abs(dz) < room.sizeZ / 2 - 1;
      const lowEnough = pos.y < room.floorY + 0.5;

      if (inX && inZ && lowEnough) {
        this.hp = Math.max(0, this.hp - 8 * dt);
        this.hud.setHp(this.hp);
        if (this.hp <= 0) this.finishMission(false);
        return;
      }
    }
  }

  // ============================================================= helpers

  private tryPhoto(): void {
    if (this.finished) return;
    if (!this.hasCamera) {
      this.hud.showToast("Нет фотоаппарата!");
      return;
    }
    if (this.shotCooldown > 0) return;
    this.shotCooldown = 0.35;
    this.takePhoto();
  }

  private tryMedkit(): void {
    if (this.finished) return;
    if (this.medkits <= 0) {
      this.hud.showToast("Аптечек нет");
      return;
    }
    if (this.hp >= 100) {
      this.hud.showToast("Здоровье полное");
      return;
    }
    if (!ShopSystem.consume("medkit")) {
      this.hud.showToast("Аптечек нет");
      return;
    }
    this.medkits -= 1;
    this.hp = Math.min(100, this.hp + 50);
    this.hud.setHp(this.hp);
    this.hud.showToast(`+50 HP · осталось аптечек: ${this.medkits}`, 2200);
  }

  private placeTorches(): void {
    // ── DEBUG: факелы отключены, чтобы проверить фонарик ──
    return;
    //const mat = new StandardMaterial("torchMat", this.scene);
    //mat.diffuseColor = new Color3(0.3, 0.15, 0.05);
    //mat.emissiveColor = new Color3(0.6, 0.3, 0.05);

    //const rooms = this.level.rooms;
    //for (let idx = 2; idx < rooms.length - 1; idx += 3) {
      //const room = rooms[idx];
      //const pos = new Vector3(room.centerX, room.floorY + 2.7, room.centerZ);

      //const light = new PointLight(`torch${idx}`, pos, this.scene);
      //light.diffuse = new Color3(1, 0.55, 0.2);
      //light.intensity = 0.85;
      //light.range = 12;
      //this.torches.push(light);

      //const flame = MeshBuilder.CreateSphere(`flame${idx}`, { diameter: 0.28 }, this.scene);
      //flame.position.copyFrom(pos);
      //flame.material = mat;
      //flame.isPickable = false;
    //}
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
    const rooms = this.level.rooms;

    const playerFloor = Math.round(
      (playerPosition.y - PLAYER_EYE_HEIGHT) / this.level.floorHeight
    );

    let bestRoom: { room: typeof rooms[number] } | null = null;
    let bestScore = -1;

    for (const room of rooms) {
      if (room.isStart || room.isGoal) continue;

      const dx = room.centerX - playerPosition.x;
      const dz = room.centerZ - playerPosition.z;
      const dy = room.floorY - playerPosition.y;
      const dist3D = Math.sqrt(dx * dx + dz * dz + dy * dy);

      if (dist3D < 8) continue;

      const sameFloor = room.cell.floor === playerFloor;
      const score = dist3D + (sameFloor ? 100 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestRoom = { room };
      }
    }

    if (!bestRoom) {
      bestRoom = { room: rooms[Math.floor(rooms.length / 2)] };
    }

    const r = bestRoom.room;
    const position = new Vector3(r.centerX, r.floorY, r.centerZ);

    this.anomalies.push(
      new Anomaly({
        scene: this.scene,
        position,
        floor: r.cell.floor,
        floorHeight: this.level.floorHeight,
        pickPatrolPoint: () => this.pickPatrolPoint(r.cell.floor),
      })
    );
  }

  private pickPatrolPoint(floor: number): Vector3 {
    const sameFloorRooms = this.level.rooms.filter((r) => r.cell.floor === floor);
    const pool = sameFloorRooms.length > 0 ? sameFloorRooms : this.level.rooms;
    const r = pool[Math.floor(Math.random() * pool.length)];
    return new Vector3(r.centerX, r.floorY, r.centerZ);
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
      const baseReward = 100;
      const speedBonus = Math.max(0, Math.floor((MISSION_TIME / 2 - spent) / 5));
      const photosBonus = this.photos * 5;
      const totalReward = baseReward + speedBonus + photosBonus;

      SaveSystem.addCoins(totalReward);

      const siteDef = rollArtifact("egypt", "site");
      const drillDef = rollArtifact("egypt", "drill");

      const siteQuality = Math.min(1, 0.5 + this.hp / 200);
      const drillQuality = Math.min(1, 0.5 + this.hp / 400);

      SaveSystem.addArtifact(siteDef.id, "egypt", siteQuality, false);
      SaveSystem.addArtifact(drillDef.id, "egypt", drillQuality, false);

      this.hud.showResult(
        "Вердикт миссии",
        [
          "Статус: успех",
          `Время экспедиции: ${this.formatDuration(spent)}`,
          `Осталось снимков: ${this.photos}`,
          `Здоровье: ${Math.round(this.hp)}%`,
          `Найдено: ${siteDef.name}`,
          `Извлечено буром: ${drillDef.name}`,
          `Награда: ${totalReward} монет`,
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