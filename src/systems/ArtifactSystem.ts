import { getArtifact } from "../data/ArtifactsData";
import { SaveSystem } from "./SaveSystem";

export class ArtifactSystem {
  /** Финальная цена с учётом качества. */
  static getPrice(index: number): number {
    const data = SaveSystem.get();
    const art = data.artifacts[index];
    if (!art || !art.restored) return 0;
    const def = getArtifact(art.id);
    if (!def) return 0;
    // Качество 0..1 → множитель 0.5..1.5
    return Math.floor(def.baseValue * (0.5 + art.quality));
  }

  /** Продать артефакт. Возвращает, сколько монет получено. */
  static sell(index: number): number {
    const price = this.getPrice(index);
    if (price <= 0) return 0;
    SaveSystem.removeArtifacts([index]);
    SaveSystem.addCoins(price);
    return price;
  }

  /**
   * Слияние: находит 3 одинаковых отреставрированных артефакта,
   * удаляет их и создаёт 1 «сырой» более высокого уровня.
   */
  static mergeFirstOfKind(baseIndex: number):
    | { ok: true; newId: string; quality: number }
    | { ok: false; reason: string } {
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
  }
}