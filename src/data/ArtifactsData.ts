export type ArtifactRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface ArtifactDef {
  id: string;
  name: string;
  location: string;
  rarity: ArtifactRarity;
  baseValue: number;
  /** Во что превращается при слиянии 3-х таких. Нет — значит максимум. */
  evolvesInto?: string;
}

export const ARTIFACTS: ArtifactDef[] = [
  // ---------- EGYPT: COMMON (серая) ----------
  { id: "clay_tablet",   name: "Глиняная табличка", location: "egypt", rarity: "common", baseValue: 25,  evolvesInto: "bronze_medallion" },
  { id: "amphora_shard", name: "Осколок амфоры",    location: "egypt", rarity: "common", baseValue: 30,  evolvesInto: "bronze_medallion" },
  { id: "old_scarab",    name: "Старый скарабей",   location: "egypt", rarity: "common", baseValue: 35,  evolvesInto: "bronze_medallion" },

  // ---------- EGYPT: UNCOMMON (зелёная) ----------
  { id: "bronze_medallion", name: "Бронзовый медальон", location: "egypt", rarity: "uncommon", baseValue: 70,  evolvesInto: "gold_scarab" },
  { id: "cat_statue",       name: "Статуэтка кошки",    location: "egypt", rarity: "uncommon", baseValue: 85,  evolvesInto: "gold_scarab" },
  { id: "ankh_amulet",      name: "Амулет Анх",         location: "egypt", rarity: "uncommon", baseValue: 95,  evolvesInto: "gold_scarab" },

  // ---------- EGYPT: RARE (синяя) ----------
  { id: "gold_scarab",   name: "Золотой скарабей",  location: "egypt", rarity: "rare", baseValue: 200, evolvesInto: "pharaoh_mask" },
  { id: "canopic_jar",   name: "Канопа",            location: "egypt", rarity: "rare", baseValue: 230, evolvesInto: "pharaoh_mask" },
  { id: "priest_mask",   name: "Маска жреца",       location: "egypt", rarity: "rare", baseValue: 270, evolvesInto: "pharaoh_mask" },

  // ---------- EGYPT: EPIC (фиолетовая) ----------
  { id: "pharaoh_mask",   name: "Маска фараона",     location: "egypt", rarity: "epic", baseValue: 700, evolvesInto: "eye_of_horus" },
  { id: "nefertiti_head", name: "Бюст Нефертити",    location: "egypt", rarity: "epic", baseValue: 850, evolvesInto: "eye_of_horus" },

  // ---------- EGYPT: LEGENDARY (золотая) ----------
  { id: "eye_of_horus", name: "Око Гора",        location: "egypt", rarity: "legendary", baseValue: 2500 },
  { id: "ra_scarab",    name: "Скарабей Ра",     location: "egypt", rarity: "legendary", baseValue: 3000 },
];

export const RARITY_COLORS: Record<ArtifactRarity, string> = {
  common:    "#a0a0a0",  // серый
  uncommon:  "#5cc46a",  // зелёный
  rare:      "#4da6ff",  // синий
  epic:      "#b266ff",  // фиолетовый
  legendary: "#ffb84d",  // золотой
};

export const RARITY_LABELS: Record<ArtifactRarity, string> = {
  common:    "Обычный",
  uncommon:  "Необычный",
  rare:      "Редкий",
  epic:      "Эпический",
  legendary: "Легендарный",
};

export const RARITY_ORDER: ArtifactRarity[] = [
  "common", "uncommon", "rare", "epic", "legendary",
];

export function getArtifact(id: string): ArtifactDef | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

/** Случайный артефакт заданной редкости в локации. */
export function pickRandomArtifact(location: string, rarity: ArtifactRarity): ArtifactDef {
  const pool = ARTIFACTS.filter((a) => a.location === location && a.rarity === rarity);
  if (pool.length === 0) return ARTIFACTS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Ролл добычи: возвращает артефакт для двух источников.
 *  • "site"  — находки на локации   → common / uncommon
 *  • "drill" — извлечено буром       → rare   / epic
 */
export function rollArtifact(
  location: string,
  source: "site" | "drill"
): ArtifactDef {
  const r = Math.random();
  if (source === "site") {
    return r < 0.7
      ? pickRandomArtifact(location, "common")
      : pickRandomArtifact(location, "uncommon");
  }
  // source === "drill"
  return r < 0.7
    ? pickRandomArtifact(location, "rare")
    : pickRandomArtifact(location, "epic");
}