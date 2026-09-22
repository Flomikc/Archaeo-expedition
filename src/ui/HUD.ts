import type { SettingsData } from "../systems/SettingsSystem";

export interface ResultButton {
  label: string;
  action: () => void;
  primary?: boolean;
}

export interface SettingsHandlers {
  onResume: () => void;
  onBackToHub: () => void;
  onChange: (patch: Partial<SettingsData>) => void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`HUD: не найден обязательный элемент #${id}`);
  return node as T;
}

/** Форматирует секунды в MM:SS. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export class HUD {
  // --- Главное меню ---
  private readonly mainMenu = el<HTMLDivElement>("main-menu");
  private readonly btnPlay = el<HTMLButtonElement>("btn-play");
  private readonly btnContinue = el<HTMLButtonElement>("btn-continue");
  private readonly menuCoins = el<HTMLSpanElement>("menu-coins");

  // --- HUD ---
  private readonly hudRoot = el<HTMLDivElement>("hud");
  private readonly hpFill = el<HTMLDivElement>("hp-fill");
  private readonly hpText = el<HTMLSpanElement>("hp-text");
  private readonly photosCount = el<HTMLSpanElement>("photos-count");
  private readonly timerEl = el<HTMLSpanElement>("timer");
  private readonly hintEl = el<HTMLDivElement>("hint");
  private readonly drillPanel = el<HTMLDivElement>("drill-panel");
  private readonly drillFill = el<HTMLDivElement>("drill-fill");
  private readonly toastEl = el<HTMLDivElement>("toast");

  // --- Ноутбук ---
  private readonly laptopMenu = el<HTMLDivElement>("laptop-menu");
  private readonly laptopCoins = el<HTMLSpanElement>("laptop-coins");
  private readonly btnLaptopClose = el<HTMLButtonElement>("btn-laptop-close");
  private readonly btnEgypt = el<HTMLButtonElement>("btn-egypt");

  // --- Настройки ---
  private readonly settingsMenu = el<HTMLDivElement>("settings-menu");
  private readonly sensSlider = el<HTMLInputElement>("sens-slider");
  private readonly sensValue = el<HTMLElement>("sens-value");
  private readonly flashSlider = el<HTMLInputElement>("flash-slider");
  private readonly flashValue = el<HTMLElement>("flash-value");
  private readonly btnSettingsResume = el<HTMLButtonElement>("btn-settings-resume");
  private readonly btnSettingsBack = el<HTMLButtonElement>("btn-settings-back");

  // --- Результат ---
  private readonly resultScreen = el<HTMLDivElement>("result-screen");
  private readonly resultTitle = el<HTMLHeadingElement>("result-title");
  private readonly resultBody = el<HTMLDivElement>("result-body");
  private readonly resultButtons = el<HTMLDivElement>("result-buttons");

  // Кэш
  private lastHint: string | null = null;
  private lastTimerText = "";
  private lastDrillPercent = -1;
  private toastTimer: number | null = null;

  private settingsHandlers: SettingsHandlers | null = null;
  private settingsBound = false;

  // ---------------------------------------------------------------- меню

  setMainMenuHandlers(onPlay: () => void, onContinue: () => void): void {
    this.btnPlay.onclick = onPlay;
    this.btnContinue.onclick = onContinue;
  }

  showMainMenu(hasSave: boolean, coins: number): void {
    this.mainMenu.classList.remove("hidden");
    this.btnContinue.classList.toggle("hidden", !hasSave);
    this.menuCoins.textContent = String(coins);
  }

  hideMainMenu(): void {
    this.mainMenu.classList.add("hidden");
  }

  // ---------------------------------------------------------------- HUD

  showHud(visible: boolean): void {
    this.hudRoot.classList.toggle("hidden", !visible);
  }

  setHudMode(mode: "hub" | "expedition"): void {
    this.hudRoot.classList.toggle("hub-mode", mode === "hub");
  }

  setHp(hp: number): void {
    const clamped = Math.max(0, Math.min(100, hp));
    this.hpFill.style.width = `${clamped}%`;
    this.hpFill.style.background =
      clamped > 50 ? "#4caf50" : clamped > 25 ? "#ff9800" : "#f44336";
    this.hpText.textContent = String(Math.round(clamped));
  }

  setPhotos(count: number): void {
    this.photosCount.textContent = String(Math.max(0, count));
  }

  setTimer(seconds: number): void {
    const text = formatTime(seconds);
    if (text === this.lastTimerText) return;
    this.lastTimerText = text;
    this.timerEl.textContent = text;
  }

  setHint(text: string | null): void {
    if (text === this.lastHint) return;
    this.lastHint = text;

    if (text) {
      this.hintEl.textContent = text;
      this.hintEl.classList.remove("hidden");
    } else {
      this.hintEl.classList.add("hidden");
    }
  }

  setDrillProgress(visible: boolean, progress: number): void {
    this.drillPanel.classList.toggle("hidden", !visible);

    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    if (percent === this.lastDrillPercent) return;
    this.lastDrillPercent = percent;
    this.drillFill.style.width = `${percent}%`;
  }

  showToast(text: string, durationMs = 2600): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");

    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add("hidden");
      this.toastTimer = null;
    }, durationMs);
  }

  // ------------------------------------------------------------- ноутбук

  setLaptopHandlers(onEgypt: () => void, onClose: () => void): void {
    this.btnEgypt.onclick = onEgypt;
    this.btnLaptopClose.onclick = onClose;
  }

  showLaptop(coins: number): void {
    this.laptopCoins.textContent = String(coins);
    this.laptopMenu.classList.remove("hidden");
  }

  hideLaptop(): void {
    this.laptopMenu.classList.add("hidden");
  }

  // ------------------------------------------------------------ настройки

  setSettingsHandlers(handlers: SettingsHandlers): void {
    this.settingsHandlers = handlers;

    if (this.settingsBound) return;
    this.settingsBound = true;

    this.sensSlider.addEventListener("input", () => {
      const value = parseFloat(this.sensSlider.value);
      this.settingsHandlers?.onChange({ sensitivity: value });
    });

    this.flashSlider.addEventListener("input", () => {
      const value = parseFloat(this.flashSlider.value);
      this.settingsHandlers?.onChange({ flashlight: value });
    });

    this.btnSettingsResume.onclick = () => this.settingsHandlers?.onResume();
    this.btnSettingsBack.onclick = () => this.settingsHandlers?.onBackToHub();
  }

  /** Обновляет значения слайдеров/лейблов. Вызывается при любом изменении настроек. */
  setSettingsValues(s: SettingsData): void {
    // Программная установка value НЕ вызывает 'input' — цикла нет
    this.sensSlider.value = String(s.sensitivity);
    this.sensValue.textContent = s.sensitivity.toFixed(1);

    this.flashSlider.value = String(s.flashlight);
    this.flashValue.textContent = s.flashlight.toFixed(2);
  }

  showSettings(showBackToHub: boolean): void {
    this.btnSettingsBack.classList.toggle("hidden", !showBackToHub);
    this.settingsMenu.classList.remove("hidden");
  }

  hideSettings(): void {
    this.settingsMenu.classList.add("hidden");
  }

  // ------------------------------------------------------------ результат

  showResult(title: string, lines: string[], buttons: ResultButton[]): void {
    this.resultTitle.textContent = title;

    this.resultBody.innerHTML = "";
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      this.resultBody.appendChild(p);
    }

    this.resultButtons.innerHTML = "";
    for (const cfg of buttons) {
      const btn = document.createElement("button");
      btn.textContent = cfg.label;
      if (cfg.primary) btn.classList.add("primary");
      btn.onclick = () => {
        this.hideResult();
        cfg.action();
      };
      this.resultButtons.appendChild(btn);
    }

    this.resultScreen.classList.remove("hidden");
  }

  hideResult(): void {
    this.resultScreen.classList.add("hidden");
  }
}