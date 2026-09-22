import { SHOP_ITEMS, ShopItem } from "../data/ShopData";
import { SaveSystem } from "./SaveSystem";

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
}

export class ShopSystem {
  static getItems(): ShopItem[] {
    return SHOP_ITEMS;
  }

  static ownedCount(id: string): number {
    const save = SaveSystem.get();
    return save.purchasedItems[id] ?? 0;
  }

  static canBuy(item: ShopItem): PurchaseResult {
    const save = SaveSystem.get();
    const owned = save.purchasedItems[item.id] ?? 0;

    if (save.coins < item.price) return { ok: false, reason: "Мало монет" };
    if (item.unique && owned > 0) return { ok: false, reason: "Уже куплено" };
    if (item.maxStack && owned >= item.maxStack) return { ok: false, reason: "Максимум" };
    return { ok: true };
  }

  static buy(id: string): PurchaseResult {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return { ok: false, reason: "Не найдено" };

    const can = this.canBuy(item);
    if (!can.ok) return can;

    const save = SaveSystem.get();
    save.coins -= item.price;
    save.purchasedItems[id] = (save.purchasedItems[id] ?? 0) + 1;
    SaveSystem.save(save);

    return { ok: true };
  }

  /** Списать один расходник. Возвращает true, если получилось. */
  static consume(id: string): boolean {
    const save = SaveSystem.get();
    const count = save.purchasedItems[id] ?? 0;
    if (count <= 0) return false;
    save.purchasedItems[id] = count - 1;
    SaveSystem.save(save);
    return true;
  }

  /** Применить все постоянные апгрейды к параметрам экспедиции. */
  static getRuntimeBonuses(): {
    drillSpeedMultiplier: number;
    startPhotosBonus: number;
    hasLockpick: boolean;
    autopickCount: number;
    medkitCount: number;
  } {
    const save = SaveSystem.get();
    const hasDrill = (save.purchasedItems["drill_upgrade"] ?? 0) > 0;
    const filmCount = save.purchasedItems["film5"] ?? 0;
    return {
      drillSpeedMultiplier: hasDrill ? 1.25 : 1.0,
      startPhotosBonus: filmCount * 5,
      hasLockpick: (save.purchasedItems["lockpick"] ?? 0) > 0,
      autopickCount: save.purchasedItems["autopick"] ?? 0,
      medkitCount: save.purchasedItems["medkit"] ?? 0,
    };
  }
}