/**
 * Круговой взлом (Skyrim-style): HTML-оверлей + requestAnimationFrame.
 */

export interface LockpickResult {
  success: boolean;
}

export class LockpickSystem {
  private readonly overlay: HTMLDivElement;
  private readonly dial: HTMLDivElement;
  private readonly needle: HTMLDivElement;
  private readonly zone: HTMLDivElement;
  private readonly attemptsEl: HTMLSpanElement;
  private readonly circleEl: HTMLSpanElement;
  private readonly failPanel: HTMLDivElement;

  private running = false;
  private angle = 0; // радианы
  private speed = 1.6; // рад/сек
  private zoneStart = 0;
  private zoneWidth = 0.45; // радианы (~26°)
  private circle = 0; // 0..2
  private attempts = 3;
  private rafId = 0;
  private lastTs = 0;
  private resolve: ((r: LockpickResult) => void) | null = null;

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.running) return;
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      this.tryLock();
    }
  };

  private readonly onClick = (e: MouseEvent): void => {
    if (!this.running) return;
    if ((e.target as HTMLElement).closest(".lockpick-fail-btns")) return;
    this.tryLock();
  };

  constructor() {
    this.ensureStyles();
    this.overlay = document.createElement("div");
    this.overlay.id = "lockpick-overlay";
    this.overlay.className = "lockpick-overlay hidden";
    this.overlay.innerHTML = `
      <div class="lockpick-panel">
        <h2>Каменный замок</h2>
        <p class="lockpick-hint">ЛКМ / Пробел — когда стрелка в зелёной зоне</p>
        <div class="lockpick-stats">
          Круг <span id="lp-circle">1</span>/3 · Попытки: <span id="lp-attempts">3</span>
        </div>
        <div class="lockpick-dial-wrap">
          <div class="lockpick-dial" id="lp-dial">
            <div class="lockpick-zone" id="lp-zone"></div>
            <div class="lockpick-needle" id="lp-needle"></div>
            <div class="lockpick-center"></div>
          </div>
        </div>
        <div class="lockpick-fail hidden" id="lp-fail">
          <p>Дверь заклинило</p>
          <div class="lockpick-fail-btns">
            <button id="lp-retry" class="primary">Попробовать снова</button>
            <button id="lp-abort">Вернуться к фуре</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.dial = this.overlay.querySelector("#lp-dial")!;
    this.needle = this.overlay.querySelector("#lp-needle")!;
    this.zone = this.overlay.querySelector("#lp-zone")!;
    this.attemptsEl = this.overlay.querySelector("#lp-attempts")!;
    this.circleEl = this.overlay.querySelector("#lp-circle")!;
    this.failPanel = this.overlay.querySelector("#lp-fail")!;

    this.overlay.querySelector("#lp-retry")!.addEventListener("click", () => {
      this.failPanel.classList.add("hidden");
      this.resetRound(true);
      this.startLoop();
    });
  }

  /** Запускает мини-игру. onAbort вызывается при «вернуться к фуре». */
  start(onAbort: () => void): Promise<LockpickResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.running = true;
      this.circle = 0;
      this.attempts = 3;
      this.speed = 1.6;
      this.failPanel.classList.add("hidden");
      this.overlay.classList.remove("hidden");

      const abortBtn = this.overlay.querySelector("#lp-abort") as HTMLButtonElement;
      abortBtn.onclick = () => {
        this.stop();
        onAbort();
        resolve({ success: false });
      };

      this.resetRound(true);
      window.addEventListener("keydown", this.onKey);
      this.overlay.addEventListener("click", this.onClick);
      this.startLoop();
    });
  }

  isOpen(): boolean {
    return this.running;
  }

  private resetRound(randomizeZone: boolean): void {
    this.angle = 0;
    if (randomizeZone) {
      this.zoneStart = Math.random() * Math.PI * 2;
    }
    this.zoneWidth = Math.max(0.28, 0.5 - this.circle * 0.07);
    this.updateUI();
    this.renderNeedle();
  }

  private startLoop(): void {
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      if (!this.running) return;
      const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
      this.lastTs = ts;
      this.angle = (this.angle + this.speed * dt) % (Math.PI * 2);
      this.renderNeedle();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private tryLock(): void {
    if (!this.running || !this.failPanel.classList.contains("hidden")) return;

    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const a = norm(this.angle);
    const z0 = norm(this.zoneStart);
    const z1 = norm(this.zoneStart + this.zoneWidth);

    let hit: boolean;
    if (z0 < z1) {
      hit = a >= z0 && a <= z1;
    } else {
      hit = a >= z0 || a <= z1;
    }

    if (hit) {
      this.circle += 1;
      if (this.circle >= 3) {
        this.finish(true);
        return;
      }
      this.speed *= 1.25;
      this.resetRound(true);
      this.flashZone("#4caf50");
    } else {
      this.attempts -= 1;
      this.updateUI();
      this.flashZone("#f44336");
      if (this.attempts <= 0) {
        cancelAnimationFrame(this.rafId);
        this.failPanel.classList.remove("hidden");
      } else {
        this.resetRound(true);
      }
    }
  }

  private finish(success: boolean): void {
    this.stop();
    this.resolve?.({ success });
    this.resolve = null;
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("keydown", this.onKey);
    this.overlay.removeEventListener("click", this.onClick);
    this.overlay.classList.add("hidden");
  }

  private updateUI(): void {
    this.attemptsEl.textContent = String(this.attempts);
    this.circleEl.textContent = String(this.circle + 1);
    const deg0 = (this.zoneStart * 180) / Math.PI;
    const degW = (this.zoneWidth * 180) / Math.PI;
    this.zone.style.background = `conic-gradient(
      transparent 0deg,
      transparent ${deg0}deg,
      rgba(76, 175, 80, 0.55) ${deg0}deg,
      rgba(76, 175, 80, 0.55) ${deg0 + degW}deg,
      transparent ${deg0 + degW}deg,
      transparent 360deg
    )`;
  }

  private renderNeedle(): void {
    const deg = (this.angle * 180) / Math.PI;
    this.needle.style.transform = `rotate(${deg}deg)`;
  }

  private flashZone(color: string): void {
    this.dial.style.boxShadow = `0 0 24px ${color}`;
    setTimeout(() => {
      this.dial.style.boxShadow = "0 0 0 transparent";
    }, 180);
  }

  private ensureStyles(): void {
    if (document.getElementById("lockpick-styles")) return;
    const style = document.createElement("style");
    style.id = "lockpick-styles";
    style.textContent = `
      .lockpick-overlay {
        position: absolute; inset: 0; z-index: 40;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 50% 40%, rgba(20,16,10,0.92), rgba(5,5,7,0.97));
      }
      .lockpick-overlay.hidden { display: none !important; }
      .lockpick-panel {
        display: flex; flex-direction: column; align-items: center; gap: 14px;
        padding: 28px 36px; border: 1px solid #4a3f28; border-radius: 10px;
        background: rgba(18,16,12,0.95); min-width: 320px; text-align: center;
      }
      .lockpick-panel h2 { color: #e8c98a; font-size: 22px; }
      .lockpick-hint { opacity: 0.65; font-size: 13px; }
      .lockpick-stats { font-size: 15px; color: #d4c4a0; }
      .lockpick-dial-wrap { padding: 12px; }
      .lockpick-dial {
        position: relative; width: 220px; height: 220px; border-radius: 50%;
        border: 3px solid #6b5a36; background: #1a1610;
        transition: box-shadow 0.15s;
      }
      .lockpick-zone {
        position: absolute; inset: 0; border-radius: 50%;
        pointer-events: none;
      }
      .lockpick-needle {
        position: absolute; left: 50%; top: 50%;
        width: 4px; height: 96px; margin-left: -2px; margin-top: -96px;
        background: linear-gradient(to top, #c9a45a, #f0e6d2);
        border-radius: 2px; transform-origin: bottom center;
        box-shadow: 0 0 6px rgba(201,164,90,0.6);
      }
      .lockpick-center {
        position: absolute; left: 50%; top: 50%;
        width: 18px; height: 18px; margin: -9px 0 0 -9px;
        border-radius: 50%; background: #c9a45a;
        border: 2px solid #8a6f34;
      }
      .lockpick-fail { margin-top: 8px; }
      .lockpick-fail.hidden { display: none !important; }
      .lockpick-fail p { color: #f44336; font-size: 18px; margin-bottom: 12px; }
      .lockpick-fail-btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    `;
    document.head.appendChild(style);
  }
}
