import { getArtifact, RARITY_COLORS } from "../data/ArtifactsData";

export interface WorkbenchResult {
  action: "restore" | "close";
  index?: number;
  quality?: number;
}

/**
 * Верстак: HTML-оверлей с canvas, на котором игрок обводит контур артефакта.
 * Качество = насколько точно игрок прошёл по траектории.
 */
export class WorkbenchSystem {
  private readonly overlay: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly titleEl: HTMLHeadingElement;
  private readonly hintEl: HTMLParagraphElement;
  private readonly qualityEl: HTMLSpanElement;

  private running = false;
  private targetPath: Array<{ x: number; y: number }> = [];
  private userPath: Array<{ x: number; y: number }> = [];
  private drawing = false;
  private finished = false;
  private currentIndex = -1;
  private resolve: ((r: WorkbenchResult) => void) | null = null;

  private readonly W = 480;
  private readonly H = 320;

  constructor() {
    this.ensureStyles();

    this.overlay = document.createElement("div");
    this.overlay.className = "workbench-overlay hidden";
    this.overlay.innerHTML = `
      <div class="workbench-panel">
        <h2 id="wb-title">Реставрация</h2>
        <p class="workbench-hint" id="wb-hint">Обведите контур артефакта, не отрывая мышь</p>
        <div class="workbench-canvas-wrap">
          <canvas id="wb-canvas" width="${this.W}" height="${this.H}"></canvas>
        </div>
        <div class="workbench-stats">
          Точность: <span id="wb-quality">—</span>
        </div>
        <div class="workbench-buttons">
          <button id="wb-finish" disabled>Завершить</button>
          <button id="wb-cancel">Отмена</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.canvas = this.overlay.querySelector("#wb-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.titleEl = this.overlay.querySelector("#wb-title") as HTMLHeadingElement;
    this.hintEl = this.overlay.querySelector("#wb-hint") as HTMLParagraphElement;
    this.qualityEl = this.overlay.querySelector("#wb-quality") as HTMLSpanElement;

    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("mouseleave", this.onMouseUp);

    (this.overlay.querySelector("#wb-finish") as HTMLButtonElement).onclick = () => this.finish();
    (this.overlay.querySelector("#wb-cancel") as HTMLButtonElement).onclick = () => this.cancel();
  }

  isOpen(): boolean {
    return this.running;
  }

  start(artifactIndex: number): Promise<WorkbenchResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.running = true;
      this.finished = false;
      this.drawing = false;
      this.currentIndex = artifactIndex;
      this.userPath = [];

      this.buildTargetPath();
      this.render();
      this.qualityEl.textContent = "—";
      (this.overlay.querySelector("#wb-finish") as HTMLButtonElement).disabled = true;

      this.overlay.classList.remove("hidden");
      (this.overlay.querySelector("#wb-title") as HTMLHeadingElement).textContent =
        `Реставрация артефакта #${artifactIndex + 1}`;
    });
  }

  // -------------------------------------------------------------- events

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.running || this.finished) return;
    const pos = this.getLocalPos(e);
    if (!pos) return;
    this.drawing = true;
    this.userPath = [pos];
    this.render();
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.drawing || !this.running || this.finished) return;
    const pos = this.getLocalPos(e);
    if (!pos) return;
    this.userPath.push(pos);
    this.render();
  };

  private readonly onMouseUp = (): void => {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.userPath.length > 10) {
      this.finished = true;
      const quality = this.evaluateQuality();
      this.qualityEl.textContent = `${Math.round(quality * 100)}%`;
      (this.overlay.querySelector("#wb-finish") as HTMLButtonElement).disabled = false;
      this.hintEl.textContent = quality > 0.75 ? "Отличная работа!" :
        quality > 0.5 ? "Неплохо, но можно точнее." : "Слишком неточно...";
    }
  };

  private getLocalPos(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.W;
    const y = ((e.clientY - rect.top) / rect.height) * this.H;
    if (x < 0 || y < 0 || x > this.W || y > this.H) return null;
    return { x, y };
  }

  // ------------------------------------------------------------- rendering

  private buildTargetPath(): void {
    // Генерируем замкнутый неправильный многоугольник (силуэт артефакта)
    const cx = this.W / 2;
    const cy = this.H / 2;
    const points = 10;
    this.targetPath = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radius = 90 + (Math.sin(i * 1.7) * 30) + (Math.cos(i * 2.3) * 20);
      this.targetPath.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.75,
      });
    }
    // Замыкаем
    this.targetPath.push({ ...this.targetPath[0] });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Фон
    ctx.fillStyle = "rgba(15, 12, 8, 0.9)";
    ctx.fillRect(0, 0, this.W, this.H);

    // Сетка
    ctx.strokeStyle = "rgba(201, 164, 90, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y < this.H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }

    // Целевой контур (пунктир)
    ctx.strokeStyle = "#c9a45a";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    for (let i = 0; i < this.targetPath.length; i++) {
      const p = this.targetPath[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Линия игрока
    if (this.userPath.length > 1) {
      ctx.strokeStyle = this.finished
        ? (this.evaluateQuality() > 0.6 ? "#4caf50" : "#f44336")
        : "#f0e6d2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < this.userPath.length; i++) {
        const p = this.userPath[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Точка старта
    if (this.userPath.length > 0) {
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath();
      ctx.arc(this.userPath[0].x, this.userPath[0].y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Оценивает точность прохождения: 1 — идеально, 0 — мимо. */
  private evaluateQuality(): number {
    if (this.userPath.length < 5) return 0;

    let totalError = 0;
    for (const p of this.userPath) {
      // Для каждой точки игрока ищем минимальное расстояние до целевого контура
      let minDist = Infinity;
      for (let i = 0; i < this.targetPath.length - 1; i++) {
        const a = this.targetPath[i];
        const b = this.targetPath[i + 1];
        const d = this.distanceToSegment(p, a, b);
        if (d < minDist) minDist = d;
      }
      totalError += minDist;
    }

    const avgError = totalError / this.userPath.length;
    // 0 пикс ошибки → 1.0, 60+ пикс → 0
    const quality = Math.max(0, 1 - avgError / 60);

    // Бонус за полное прохождение
    const covered = this.coverageRatio();
    return Math.min(1, quality * (0.5 + covered * 0.5));
  }

  private coverageRatio(): number {
    // Считаем, сколько точек целевого контура было близко к линии игрока
    let covered = 0;
    for (const t of this.targetPath) {
      let minDist = Infinity;
      for (const p of this.userPath) {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        if (d < minDist) minDist = d;
      }
      if (minDist < 25) covered++;
    }
    return covered / this.targetPath.length;
  }

  private distanceToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  // --------------------------------------------------------------- finish

  private finish(): void {
    if (!this.finished || !this.running) return;
    const quality = this.evaluateQuality();
    this.stop();
    this.resolve?.({ action: "restore", index: this.currentIndex, quality });
    this.resolve = null;
  }

  private cancel(): void {
    this.stop();
    this.resolve?.({ action: "close" });
    this.resolve = null;
  }

  private stop(): void {
    this.running = false;
    this.drawing = false;
    this.finished = false;
    this.overlay.classList.add("hidden");
  }

  // --------------------------------------------------------------- styles

  private ensureStyles(): void {
    if (document.getElementById("workbench-styles")) return;
    const style = document.createElement("style");
    style.id = "workbench-styles";
    style.textContent = `
      .workbench-overlay {
        position: absolute; inset: 0; z-index: 45;
        display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 50% 40%, rgba(20,16,10,0.9), rgba(5,5,7,0.95));
      }
      .workbench-overlay.hidden { display: none !important; }
      .workbench-panel {
        display: flex; flex-direction: column; align-items: center; gap: 12px;
        padding: 24px 28px; border: 1px solid #4a3f28; border-radius: 10px;
        background: rgba(18,16,12,0.97); text-align: center;
      }
      .workbench-panel h2 { color: #e8c98a; font-size: 22px; margin: 0; }
      .workbench-hint { opacity: 0.7; font-size: 13px; margin: 0; }
      .workbench-canvas-wrap {
        border: 1px solid #3a3024; border-radius: 8px; overflow: hidden;
        box-shadow: inset 0 0 30px rgba(0,0,0,0.6);
        cursor: crosshair;
      }
      #wb-canvas { display: block; }
      .workbench-stats { font-size: 15px; color: #d4c4a0; }
      .workbench-buttons { display: flex; gap: 12px; }
      .workbench-buttons button { min-width: 140px; }
      .workbench-buttons button:disabled { opacity: 0.4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }
}