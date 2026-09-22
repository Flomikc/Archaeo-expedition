export type ShopCategory = "tools" | "upgrades" | "consumables";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ShopCategory;
  /** Если true — покупается один раз навсегда. */
  unique?: boolean;
  /** Максимум штук в инвентаре. */
  maxStack?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "lockpick",
    name: "Отмычка",
    description: "Позволяет вскрывать каменные замки вручную (мини-игра).",
    price: 50,
    unique: true,
    category: "tools",
  },
  {
    id: "autopick",
    name: "Автовзлом",
    description: "Мгновенно открывает одну дверь. Тратится при использовании.",
    price: 100,
    maxStack: 5,
    category: "consumables",
  },
  {
    id: "film5",
    name: "Плёнка (+5 снимков)",
    description: "Добавляет 5 снимков к стартовому запасу фотоаппарата.",
    price: 75,
    maxStack: 3,
    category: "consumables",
  },
  {
    id: "drill_upgrade",
    name: "Алмазное сверло",
    description: "Ускоряет бур на 25% навсегда.",
    price: 200,
    unique: true,
    category: "upgrades",
  },
  {
    id: "medkit",
    name: "Аптечка",
    description: "Восстанавливает 50 HP в экспедиции (одноразово).",
    price: 80,
    maxStack: 3,
    category: "consumables",
  },
];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  tools: "Инструменты",
  upgrades: "Улучшения",
  consumables: "Расходники",
};