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
  private readonly mapGrid = el<HTMLDivElement>("map-grid");
  private readonly shopList = el<HTMLDivElement>("shop-list");
  private readonly invList = el<HTMLDivElement>("inv-list");

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

  private shopBuyHandler: ((id: string) => void) | null = null;
  private locationSelectHandler: ((id: string) => void) | null = null;
  private laptopCloseHandler: (() => void) | null = null;

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

  setLaptopHandlers(handlers: {
    onClose: () => void;
    onSelectLocation: (id: string) => void;
    onBuyItem: (id: string) => void;
  }): void {
    this.laptopCloseHandler = handlers.onClose;
    this.locationSelectHandler = handlers.onSelectLocation;
    this.shopBuyHandler = handlers.onBuyItem;

    this.btnLaptopClose.onclick = () => this.laptopCloseHandler?.();

    const tabs = this.laptopMenu.querySelectorAll<HTMLButtonElement>(".laptop-tab[data-tab]");
    tabs.forEach((tab) => {
      tab.onclick = () => this.setLaptopTab(tab.dataset.tab ?? "map");
    });

    const cards = this.mapGrid.querySelectorAll<HTMLButtonElement>(".map-card");
    cards.forEach((card) => {
      card.onclick = () => {
        if (card.disabled || card.classList.contains("locked")) return;
        const id = card.dataset.location;
        if (id) this.locationSelectHandler?.(id);
      };
    });
  }

  setLaptopTab(tabId: string): void {
    const tabs = this.laptopMenu.querySelectorAll<HTMLButtonElement>(".laptop-tab[data-tab]");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });
    const panels = this.laptopMenu.querySelectorAll<HTMLDivElement>(".tab-panel");
    panels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `tab-${tabId}`);
    });
  }

  showLaptop(coins: number): void {
    this.laptopCoins.textContent = String(coins);
    this.laptopMenu.classList.remove("hidden");
    this.setLaptopTab("map");
  }

  hideLaptop(): void {
    this.laptopMenu.classList.add("hidden");
  }

  setLaptopCoins(coins: number): void {
    this.laptopCoins.textContent = String(coins);
  }

  renderShop(
    items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      owned: number;
      maxStack?: number;
      unique?: boolean;
    }>
  ): void {
    this.shopList.innerHTML = "";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "shop-item";

      const maxed = (item.maxStack && item.owned >= item.maxStack) ||
        (item.unique && item.owned > 0);

      const left = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.name;
      if (item.owned > 0) title.textContent += ` ×${item.owned}`;
      left.appendChild(title);
      const desc = document.createElement("small");
      desc.textContent = item.description;
      left.appendChild(desc);

      const price = document.createElement("span");
      price.className = "shop-price";
      price.textContent = `${item.price} ⛁`;

      const btn = document.createElement("button");
      btn.textContent = maxed ? "Куплено" : "Купить";
      btn.disabled = !!maxed;
      btn.onclick = () => {
        this.shopBuyHandler?.(item.id);
      };

      row.appendChild(left);
      row.appendChild(price);
      row.appendChild(btn);
      this.shopList.appendChild(row);
    }
  }

  private artifactHandlers: {
    onRestore: (index: number) => void;
    onSell: (index: number) => void;
    onMerge: (indices: number[]) => void;
  } | null = null;

  setArtifactHandlers(handlers: {
    onRestore: (index: number) => void;
    onSell: (index: number) => void;
    onMerge: (indices: number[]) => void;
  }): void {
    this.artifactHandlers = handlers;
  }

  renderInventory(
    artifacts: Array<{ id: string; location: string; quality: number; restored: boolean }>
  ): void {
    this.invList.innerHTML = "";
    if (artifacts.length === 0) {
      const msg = document.createElement("div");
      msg.className = "empty-msg";
      msg.textContent = "Пока пусто. Артефакты появятся после экспедиций.";
      this.invList.appendChild(msg);
      return;
    }

    // Импортируем по месту, чтобы не ломать сборку циклическими зависимостями
    // (в модульной системе Vite это нормально, но здесь проще через require-стиль
    //  передачи объекта из ArtifactsData — оставим простой статический доступ).
    const { getArtifact, RARITY_COLORS, RARITY_LABELS } =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (window as unknown as {
        __artifactMeta: typeof import("../data/ArtifactsData");
      }).__artifactMeta;

    for (let i = 0; i < artifacts.length; i++) {
      const art = artifacts[i];
      const def = getArtifact(art.id);
      const rarity = def?.rarity ?? "common";
      const color = RARITY_COLORS[rarity];
      const label = RARITY_LABELS[rarity];

      const row = document.createElement("div");
      row.className = "inv-item";
      row.style.borderLeft = `4px solid ${color}`;

      const left = document.createElement("div");
      const t = document.createElement("b");
      t.textContent = def?.name ?? art.id;
      t.style.color = color;
      const s = document.createElement("small");
      s.textContent =
        `${label} · качество ${Math.round(art.quality * 100)}%` +
        (art.restored ? "" : " · требует реставрации");
      left.appendChild(t);
      left.appendChild(s);

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      if (!art.restored) {
        const btn = document.createElement("button");
        btn.textContent = "Реставрировать";
        btn.style.minWidth = "0";
        btn.style.padding = "5px 12px";
        btn.style.fontSize = "12px";
        btn.onclick = () => this.artifactHandlers?.onRestore(i);
        actions.appendChild(btn);
      } else {
        const sellBtn = document.createElement("button");
        sellBtn.textContent = "Продать";
        sellBtn.style.minWidth = "0";
        sellBtn.style.padding = "5px 12px";
        sellBtn.style.fontSize = "12px";
        sellBtn.onclick = () => this.artifactHandlers?.onSell(i);
        actions.appendChild(sellBtn);

        if (def?.evolvesInto) {
          const mergeBtn = document.createElement("button");
          mergeBtn.textContent = "Слияние";
          mergeBtn.style.minWidth = "0";
          mergeBtn.style.padding = "5px 12px";
          mergeBtn.style.fontSize = "12px";
          mergeBtn.onclick = () => this.artifactHandlers?.onMerge([i]);
          actions.appendChild(mergeBtn);
        }
      }

      row.appendChild(left);
      row.appendChild(actions);
      this.invList.appendChild(row);
    }
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

  setSettingsValues(s: SettingsData): void {
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