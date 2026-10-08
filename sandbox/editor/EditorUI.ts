import { Mesh } from "@babylonjs/core";

import { EditorScene, exportToJSON } from "./EditorScene";
import { OBJECT_TYPES } from "./ObjectTypes";

// ============================================================
//  ХЕЛПЕР
// ============================================================

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Не найден элемент #${id}`);
  return node as T;
}

// ============================================================
//  EDITOR UI
// ============================================================

export class EditorUI {
  private readonly editor: EditorScene;

  private readonly paletteList: HTMLElement;
  private readonly objectList: HTMLElement;
  private readonly objectCount: HTMLElement;

  private readonly inspectorPanel: HTMLElement;
  private readonly inspectorBody: HTMLElement;
  private readonly inspectorTitle: HTMLElement;

  private readonly btnDelete: HTMLButtonElement;
  private readonly btnDuplicate: HTMLButtonElement;

  private readonly btnClearAll: HTMLButtonElement;
  private readonly btnExport: HTMLButtonElement;
  private readonly btnResetCamera: HTMLButtonElement;
  private readonly roomIdInput: HTMLInputElement;

  private readonly exportModal: HTMLElement;
  private readonly exportTextarea: HTMLTextAreaElement;
  private readonly btnCopyExport: HTMLButtonElement;
  private readonly btnCloseExport: HTMLButtonElement;

  constructor(editor: EditorScene) {
    this.editor = editor;

    this.paletteList = el<HTMLElement>("palette-list");
    this.objectList = el<HTMLElement>("object-list");
    this.objectCount = el<HTMLElement>("object-count");
    this.inspectorPanel = el<HTMLElement>("panel-right");
    this.inspectorBody = el<HTMLElement>("inspector-body");
    this.inspectorTitle = el<HTMLElement>("inspector-title");
    this.btnDelete = el<HTMLButtonElement>("btn-delete");
    this.btnDuplicate = el<HTMLButtonElement>("btn-duplicate");
    this.btnClearAll = el<HTMLButtonElement>("btn-clear-all");
    this.btnExport = el<HTMLButtonElement>("btn-export");
    this.btnResetCamera = el<HTMLButtonElement>("btn-reset-camera");
    this.roomIdInput = el<HTMLInputElement>("room-id");
    this.exportModal = el<HTMLElement>("export-modal");
    this.exportTextarea = el<HTMLTextAreaElement>("export-textarea");
    this.btnCopyExport = el<HTMLButtonElement>("btn-copy-export");
    this.btnCloseExport = el<HTMLButtonElement>("btn-close-export");

    this.buildInspectorOnce();
    this.buildPalette();
    this.populateBlueprintLoader();
    this.bindGeneralButtons();

    this.refreshInspector(null);
  }

  // ============================================================
  //  ПАЛИТРА
  // ============================================================

  private buildPalette(): void {
    this.paletteList.innerHTML = "";

    for (const def of OBJECT_TYPES) {
      const btn = document.createElement("button");
      btn.className = "palette-btn";
      btn.innerHTML = `
        <span class="palette-dot" data-shape="${def.shape}"></span>
        <span class="palette-label">${def.label}</span>
        <span class="palette-size">${def.defaultW}×${def.defaultH}×${def.defaultD}</span>
      `;
      btn.addEventListener("click", () => {
        this.editor.addObject(def.type);
      });
      this.paletteList.appendChild(btn);
    }
  }

  // ============================================================
  //  ЗАГРУЗКА BLUEPRINT'ОВ
  // ============================================================

  private populateBlueprintLoader(): void {
    const select = document.getElementById("blueprint-loader") as HTMLSelectElement | null;
    if (!select) return;

    const bps = this.editor.getAvailableBlueprints();
    bps.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.id.localeCompare(b.id);
    });

    for (const bp of bps) {
      const opt = document.createElement("option");
      opt.value = bp.id;
      opt.textContent = `[${bp.category}] ${bp.label}`;
      select.appendChild(opt);
    }

    select.addEventListener("change", () => {
      const id = select.value;
      if (!id) return;
      if (!confirm(`Загрузить комнату "${id}"? Текущее содержимое будет очищено.`)) {
        select.value = "";
        return;
      }
      const ok = this.editor.loadBlueprint(id);
      if (ok) this.roomIdInput.value = id;
    });
  }

  // ============================================================
  //  СПИСОК ОБЪЕКТОВ
  // ============================================================

  refreshObjectList(meshes: Mesh[]): void {
    this.objectCount.textContent = String(meshes.length);
    this.objectList.innerHTML = "";

    for (const mesh of meshes) {
      const meta = mesh.metadata as { type: string };
      const row = document.createElement("div");
      row.className = "object-row";
      const attached = this.editor.gizmos.attachedMesh;
      if (attached === mesh) row.classList.add("active");

      const nameSpan = document.createElement("span");
      nameSpan.className = "object-name";
      nameSpan.textContent = mesh.name;

      const typeSpan = document.createElement("span");
      typeSpan.className = "object-type";
      typeSpan.textContent = meta.type;

      row.appendChild(nameSpan);
      row.appendChild(typeSpan);
      row.addEventListener("click", () => this.editor.select(mesh));
      this.objectList.appendChild(row);
    }
  }

  private updateActiveRow(): void {
    const attached = this.editor.gizmos.attachedMesh;
    const rows = this.objectList.querySelectorAll(".object-row");
    const meshes = this.editor.getObjects();
    rows.forEach((row, i) => {
      const m = meshes[i];
      if (!m) return;
      row.classList.toggle("active", attached === m);
    });
  }

  // ============================================================
  //  ИНСПЕКТОР
  // ============================================================

  private buildInspectorOnce(): void {
    this.inspectorBody.innerHTML = `
      <div class="section">
        <h3>Позиция (м)</h3>
        <label class="field"><span>X</span>
          <input id="field-X" type="number" step="0.1" /></label>
        <label class="field"><span>Y</span>
          <input id="field-Y" type="number" step="0.1" /></label>
        <label class="field"><span>Z</span>
          <input id="field-Z" type="number" step="0.1" /></label>
      </div>

      <div class="section">
        <h3>Поворот (градусы)</h3>
        <label class="field"><span>RX</span>
          <input id="field-RX" type="number" step="1" /></label>
        <label class="field"><span>RY</span>
          <input id="field-RY" type="number" step="1" /></label>
        <label class="field"><span>RZ</span>
          <input id="field-RZ" type="number" step="1" /></label>
      </div>

      <div class="section">
        <h3>Размер (м)</h3>
        <label class="field"><span>Ширина X</span>
          <input id="field-W" type="number" step="0.05" /></label>
        <label class="field"><span>Высота Y</span>
          <input id="field-H" type="number" step="0.05" /></label>
        <label class="field"><span>Глубина Z</span>
          <input id="field-D" type="number" step="0.05" /></label>
      </div>

      <div class="section">
        <h3>Материал</h3>
        <label class="field">
          <span>Материал</span>
          <select id="field-material"></select>
        </label>
      </div>

      <div class="section">
        <h3>Текстура — масштаб</h3>
        <label class="field"><span>uScale (повтор по X)</span>
          <input id="field-TEXU" type="number" step="0.5" /></label>
        <label class="field"><span>vScale (повтор по Y)</span>
          <input id="field-TEXV" type="number" step="0.5" /></label>
      </div>

      <div class="section">
        <h3>Текстура — смещение</h3>
        <label class="field"><span>uOffset</span>
          <input id="field-TEXOU" type="number" step="0.05" /></label>
        <label class="field"><span>vOffset</span>
          <input id="field-TEXOV" type="number" step="0.05" /></label>
      </div>

      <div class="section">
        <h3>Текстура — вращение</h3>
        <label class="field"><span>wAng (°)</span>
          <input id="field-TEXW" type="number" step="1" /></label>
      </div>
    `;

    const D2R = Math.PI / 180;

    // ── bindNum для позиции/поворота/размера ───────────────
    const bindNum = (
      id: string,
      key: "x" | "y" | "z" | "rx" | "ry" | "rz" | "w" | "h" | "d",
      converter?: (v: number) => number
    ) => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      if (!inp) return;
      inp.addEventListener("input", () => {
        const raw = inp.value.trim();
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
        const v = parseFloat(raw);
        if (!Number.isFinite(v)) return;
        const val = converter ? converter(v) : v;
        this.editor.updateSelectedTransform({ [key]: val } as never);
      });
      inp.addEventListener("keydown", (e) => {
        if (e.code === "Enter") inp.blur();
      });
    };

    // ── bindTex для текстуры ───────────────────────────────
    const bindTex = (
      id: string,
      key: "uScale" | "vScale" | "uOffset" | "vOffset" | "wAng",
      converter?: (v: number) => number
    ) => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      if (!inp) return;
      inp.addEventListener("input", () => {
        const raw = inp.value.trim();
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
        const v = parseFloat(raw);
        if (!Number.isFinite(v)) return;
        const val = converter ? converter(v) : v;
        this.editor.updateSelectedTransform({ tex: { [key]: val } });
      });
      inp.addEventListener("keydown", (e) => {
        if (e.code === "Enter") inp.blur();
      });
    };

    bindNum("field-X", "x");
    bindNum("field-Y", "y");
    bindNum("field-Z", "z");
    bindNum("field-RX", "rx", (v) => v * D2R);
    bindNum("field-RY", "ry", (v) => v * D2R);
    bindNum("field-RZ", "rz", (v) => v * D2R);
    bindNum("field-W", "w");
    bindNum("field-H", "h");
    bindNum("field-D", "d");

    bindTex("field-TEXU", "uScale");
    bindTex("field-TEXV", "vScale");
    bindTex("field-TEXOU", "uOffset");
    bindTex("field-TEXOV", "vOffset");
    bindTex("field-TEXW", "wAng", (v) => v * D2R);

    // ── Dropdown материалов ────────────────────────────────
    const matSelInit = document.getElementById("field-material") as HTMLSelectElement | null;
    if (matSelInit) {
      matSelInit.innerHTML = "";
      for (const id of this.editor.materials.getIds()) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = id;
        matSelInit.appendChild(opt);
      }
      matSelInit.addEventListener("change", () => {
        this.editor.updateSelectedTransform({ material: matSelInit.value });
      });
    }
  }

  refreshInspector(mesh: Mesh | null): void {
    if (!mesh) {
      this.inspectorPanel.classList.add("disabled");
      this.inspectorTitle.textContent = "Ничего не выбрано";
      this.inspectorBody.style.opacity = "0.35";
      this.inspectorBody.style.pointerEvents = "none";
      this.updateActiveRow();
      return;
    }

    this.inspectorPanel.classList.remove("disabled");
    this.inspectorBody.style.opacity = "1";
    this.inspectorBody.style.pointerEvents = "auto";
    this.inspectorTitle.textContent = mesh.name;

    this.updateInspectorValues(mesh);

    const meta = mesh.metadata as { material?: string } | undefined;
    const matSel = document.getElementById("field-material") as HTMLSelectElement | null;
    if (matSel && meta?.material && document.activeElement !== matSel) {
      matSel.value = meta.material;
    }

    this.updateActiveRow();
  }

  updateInspectorValues(mesh: Mesh): void {
    const R2D = 180 / Math.PI;

    const set = (id: string, v: number, digits = 2) => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      if (!inp) return;
      if (document.activeElement === inp) return;
      inp.value = v.toFixed(digits);
    };

    set("field-X", mesh.position.x);
    set("field-Y", mesh.position.y);
    set("field-Z", mesh.position.z);
    set("field-RX", mesh.rotation.x * R2D, 1);
    set("field-RY", mesh.rotation.y * R2D, 1);
    set("field-RZ", mesh.rotation.z * R2D, 1);

    const meta = mesh.metadata as
      | { w?: number; h?: number; d?: number; tex?: {
          uScale: number; vScale: number;
          uOffset: number; vOffset: number; wAng: number;
        } }
      | undefined;

    if (meta) {
      set("field-W", meta.w ?? 0);
      set("field-H", meta.h ?? 0);
      set("field-D", meta.d ?? 0);

      if (meta.tex) {
        set("field-TEXU", meta.tex.uScale, 2);
        set("field-TEXV", meta.tex.vScale, 2);
        set("field-TEXOU", meta.tex.uOffset, 3);
        set("field-TEXOV", meta.tex.vOffset, 3);
        set("field-TEXW", meta.tex.wAng * R2D, 1);
      }
    }
  }

  // ============================================================
  //  ОБЩИЕ КНОПКИ
  // ============================================================

  private bindGeneralButtons(): void {
    this.btnDelete.addEventListener("click", () => this.editor.deleteSelected());
    this.btnDuplicate.addEventListener("click", () => this.editor.duplicateSelected());

    this.btnClearAll.addEventListener("click", () => {
      if (confirm("Удалить все объекты? Это действие нельзя отменить.")) {
        this.editor.clearAll();
      }
    });

    this.btnResetCamera.addEventListener("click", () => this.editor.resetCamera());

    this.btnExport.addEventListener("click", () => {
      const roomId = this.roomIdInput.value.trim() || "untitled";
      const data = exportToJSON(
        this.editor.getObjects(),
        roomId,
        { x: 18, z: 18, wallHeight: 4.5 }
      );
      this.exportTextarea.value = JSON.stringify(data, null, 2);
      this.exportModal.classList.remove("hidden");
    });

    this.btnCopyExport.addEventListener("click", () => {
      this.exportTextarea.select();
      document.execCommand("copy");
      this.btnCopyExport.textContent = "✓ Скопировано";
      setTimeout(() => (this.btnCopyExport.textContent = "Скопировать"), 1500);
    });

    this.btnCloseExport.addEventListener("click", () => {
      this.exportModal.classList.add("hidden");
    });
  }
}