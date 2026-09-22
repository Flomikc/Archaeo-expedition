import { Engine } from "@babylonjs/core";

import { DesertScene } from "./scenes/DesertScene";
import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { HubScene } from "./scenes/HubScene";
import { SaveSystem } from "./systems/SaveSystem";
import { SettingsSystem } from "./systems/SettingsSystem";
import { HUD } from "./ui/HUD";

type ActiveScene = HubScene | DesertScene | ExpeditionScene;
type SceneKind = "hub" | "desert" | "expedition";
type GameState = "menu" | "playing";

class Game {
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: HUD;

  private active: ActiveScene | null = null;
  private activeKind: SceneKind = "hub";
  private state: GameState = "menu";
  private pauseOpen = false;

  private readonly onWheel = (e: WheelEvent): void => {
    if (this.state !== "playing" || this.pauseOpen) return;
    if (this.active?.shouldSuppressPause()) return;
    e.preventDefault();
    const step = 0.05;
    const s = SettingsSystem.get();
    const next = s.flashlight + (e.deltaY > 0 ? step : -step);
    SettingsSystem.set({ flashlight: next });
  };

  private readonly onCanvasClick = (): void => {
    if (this.state !== "playing" || this.pauseOpen) return;
    if (this.active?.shouldSuppressPause()) return;
    if (!this.engine.isPointerLock) {
      this.engine.enterPointerlock();
    }
  };

  private readonly onPointerLockChange = (): void => {
    if (this.state !== "playing" || this.pauseOpen) return;
    if (this.active?.shouldSuppressPause()) return;
    if (!this.engine.isPointerLock) {
      this.openPause();
    }
  };

  constructor() {
    const canvas = document.getElementById("game-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Не найден <canvas id="game-canvas">');
    }
    this.canvas = canvas;

    this.engine = new Engine(this.canvas, true, { stencil: false }, true);
    this.hud = new HUD();

    SettingsSystem.load();
    SettingsSystem.subscribe((s) => this.hud.setSettingsValues(s));
    this.hud.setSettingsValues(SettingsSystem.get());

    this.hud.setMainMenuHandlers(
      () => this.startNewGame(),
      () => this.startNewGame()
    );

    this.hud.setSettingsHandlers({
      onResume: () => this.closePause(),
      onBackToHub: () => {
        this.closePause();
        this.state = "playing";
        this.startHub();
      },
      onChange: (patch) => SettingsSystem.set(patch),
    });

    this.hud.showMainMenu(SaveSystem.hasSave(), SaveSystem.get().coins);

    this.canvas.addEventListener("click", this.onCanvasClick);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", () => this.engine.resize());

    this.engine.runRenderLoop(() => this.renderFrame());
  }

  private startNewGame(): void {
    this.hud.hideMainMenu();
    this.state = "playing";
    this.startHub();
  }

  private startHub(): void {
    this.disposeActive();
    this.hud.hideResult();
    this.hud.hideLaptop();
    this.hud.hideSettings();
    this.hud.showHud(false);

    this.activeKind = "hub";
    this.active = new HubScene({
      engine: this.engine,
      canvas: this.canvas,
      hud: this.hud,
      onGoToDesert: () => this.startDesert(),
    });
    this.requestPointerLock();
  }

  private startDesert(): void {
    this.disposeActive();
    this.hud.hideResult();
    this.hud.hideLaptop();
    this.hud.hideSettings();

    this.activeKind = "desert";
    this.active = new DesertScene({
      engine: this.engine,
      canvas: this.canvas,
      hud: this.hud,
      onEnterPyramid: () => this.startExpedition(),
      onReturnToHub: () => this.startHub(),
    });
    this.requestPointerLock();
  }

  private startExpedition(): void {
    this.disposeActive();
    this.hud.hideResult();
    this.hud.hideLaptop();
    this.hud.hideSettings();

    this.activeKind = "expedition";
    this.active = new ExpeditionScene({
      engine: this.engine,
      canvas: this.canvas,
      hud: this.hud,
      onReturnToHub: () => this.startHub(),
      onRestart: () => this.startExpedition(),
    });
    this.requestPointerLock();
  }

  private disposeActive(): void {
    if (this.active) {
      this.active.dispose();
      this.active = null;
    }
  }

  private requestPointerLock(): void {
    if (this.pauseOpen) return;
    this.engine.enterPointerlock();
  }

  private openPause(): void {
    if (this.pauseOpen) return;
    this.pauseOpen = true;
    (document.activeElement as HTMLElement | null)?.blur();
    this.hud.setSettingsValues(SettingsSystem.get());
    this.hud.showSettings(this.activeKind === "expedition" || this.activeKind === "desert");
    this.active?.setEnabled(false);
    if (this.engine.isPointerLock) {
      this.engine.exitPointerlock();
    }
  }

  private closePause(): void {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    (document.activeElement as HTMLElement | null)?.blur();
    this.hud.hideSettings();
    this.active?.setEnabled(true);
    if (this.state === "playing") {
      this.engine.enterPointerlock();
    }
  }

  private renderFrame(): void {
    const current = this.active;
    if (!current) return;

    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);

    if (!this.pauseOpen && !current.shouldSuppressPause()) {
      current.update(dt);
    } else if (!this.pauseOpen) {
      current.update(0);
    }

    if (this.active === current) {
      current.scene.render();
    }
  }
}

new Game();