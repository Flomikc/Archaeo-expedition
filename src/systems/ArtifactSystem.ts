import { getArtifact } from "../data/ArtifactsData";
import { SaveSystem } from "./SaveSystem";
import { ValidationError, ArtifactError } from "./errors";

export class ArtifactSystem {
  static getPrice(index: number): number {
    // Программная ошибка: некорректный индекс
    if (!Number.isInteger(index) || index < 0) {
      throw new ArtifactError("getPrice: некорректный индекс", { index });
    }
    const data = SaveSystem.get();
    if (index >= data.artifacts.length) return 0; // нет артефакта — цена 0, это ок

    const art = data.artifacts[index];
    if (!art || !art.restored) return 0;

    const def = getArtifact(art.id);
    if (!def) return 0;

    return Math.floor(def.baseValue * (0.5 + art.quality));
  }

  static sell(index: number): number {
    const price = this.getPrice(index);
    if (price <= 0) return 0;
    SaveSystem.removeArtifacts([index]);
    SaveSystem.addCoins(price);
    return price;
  }

  static mergeFirstOfKind(baseIndex: number):
    | { ok: true; newId: string; quality: number }
    | { ok: false; reason: string } {
    // Программная ошибка
    if (!Number.isInteger(baseIndex) || baseIndex < 0) {
      throw new ArtifactError("mergeFirstOfKind: некорректный индекс", { baseIndex });
    }

    const data = SaveSystem.get();
    const base = data.artifacts[baseIndex];

    // Ожидаемые бизнес-отказы — возвращаем reason, не бросаем
    if (!base) return { ok: false, reason: "Артефакт не найден" };
    if (!base.restored) return { ok: false, reason: "Сначала реставрируйте" };

    const def = getArtifact(base.id);
    if (!def) throw new ArtifactError("mergeFirstOfKind: неизвестный артефакт", { id: base.id });
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