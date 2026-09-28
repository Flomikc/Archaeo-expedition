import { getArtifact } from "../data/ArtifactsData";
import { SaveSystem } from "./SaveSystem";
import { ValidationError } from "./errors";

export class ArtifactSystem {
  static getPrice(index: number): number {
    if (index < 0) return 0;
    const data = SaveSystem.get();
    if (index >= data.artifacts.length) return 0;

    const art = data.artifacts[index];
    if (!art || !art.restored) return 0;

    const def = getArtifact(art.id);
    if (!def) return 0;

    return Math.floor(def.baseValue * (0.5 + art.quality));
  }

  static sell(index: number): number {
    try {
      const price = this.getPrice(index);
      if (price <= 0) return 0;
      SaveSystem.removeArtifacts([index]);
      SaveSystem.addCoins(price);
      return price;
    } catch (e) {
      console.error("[ArtifactSystem.sell] Ошибка:", e);
      return 0;
    }
  }

  static mergeFirstOfKind(baseIndex: number):
    | { ok: true; newId: string; quality: number }
    | { ok: false; reason: string } {
    try {
      if (baseIndex < 0) throw new ValidationError("Некорректный индекс");

      const data = SaveSystem.get();
      const base = data.artifacts[baseIndex];
      if (!base) return { ok: false, reason: "Артефакт не найден" };
      if (!base.restored) return { ok: false, reason: "Сначала реставрируйте" };

      const def = getArtifact(base.id);
      if (!def) return { ok: false, reason: "Неизвестный артефакт" };
      if (!def.evolvesInto) return { ok: false, reason: "Максимальный уровень" };

      const indices: number[] = [];
      for (let i = 0; i < data.artifacts.length; i++) {
        const a = data.artifacts[i];
        if (a.restored && a.id === base.id) indices.push(i);
        if (indices.length === 3) break;
      }
      if (indices.length < 3) {
        return { ok: false, reason: `Нужно 3 одинаковых (есть ${indices.length})` };
      }

      const avgQuality =
        indices.reduce((sum, i) => sum + data.artifacts[i].quality, 0) / indices.length;

      SaveSystem.removeArtifacts(indices);

      const save = SaveSystem.get();
      save.artifacts.push({
        id: def.evolvesInto,
        location: base.location,
        quality: avgQuality,
        restored: false,
      });
      SaveSystem.save(save);

      return { ok: true, newId: def.evolvesInto, quality: avgQuality };
    } catch (e) {
      console.error("[ArtifactSystem.mergeFirstOfKind] Ошибка:", e);
      return { ok: false, reason: "Внутренняя ошибка слияния" };
    }
  }
}