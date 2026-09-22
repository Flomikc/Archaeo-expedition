export type ArtifactRarity = "common" | "rare" | "epic" | "legendary";

export interface ArtifactDef {
  id: string;
  name: string;
  location: string;
  rarity: ArtifactRarity;
  baseValue: number;
  /** Идентификатор «следующего» артефакта при слиянии. */
  evolvesInto?: string;
}

export const ARTIFACTS: ArtifactDef[] = [
  // Египет
  { id: "scarab", name: "Скарабей", location: "egypt", rarity: "common", baseValue: 40, evolvesInto: "scarab_rare" },
  { id: "scarab_rare", name: "Золотой скарабей", location: "egypt", rarity: "rare", baseValue: 120, evolvesInto: "scarab_epic" },
  { id: "scarab_epic", name: "Скарабей фараона", location: "egypt", rarity: "epic", baseValue: 400, evolvesInto: "scarab_legend" },
  { id: "scarab_legend", name: "Скарабей Ра", location: "egypt", rarity: "legendary", baseValue: 1500 },

  { id: "amulet", name: "Амулет Анх", location: "egypt", rarity: "common", baseValue: 55, evolvesInto: "amulet_rare" },
  { id: "amulet_rare", name: "Амулет богов", location: "egypt", rarity: "rare", baseValue: 160, evolvesInto: "amulet_epic" },
  { id: "amulet_epic", name: "Амулет Осириса", location: "egypt", rarity: "epic", baseValue: 550, evolvesInto: "amulet_legend" },
  { id: "amulet_legend", name: "Амулет вечности", location: "egypt", rarity: "legendary", baseValue: 2000 },

  { id: "mask", name: "Маска жреца", location: "egypt", rarity: "rare", baseValue: 200, evolvesInto: "mask_epic" },
  { id: "mask_epic", name: "Маска царицы", location: "egypt", rarity: "epic", baseValue: 700, evolvesInto: "mask_legend" },
  { id: "mask_legend", name: "Маска Нефертити", location: "egypt", rarity: "legendary", baseValue: 2500 },
];

export const RARITY_COLORS: Record<ArtifactRarity, string> = {
  common: "#b0b0b0",
  rare: "#4da6ff",
  epic: "#b266ff",
  legendary: "#ffb84d",
};

export const RARITY_LABELS: Record<ArtifactRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

export function getArtifact(id: string): ArtifactDef | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function pickRandomArtifact(location: string, rarity: ArtifactRarity): ArtifactDef {
  const pool = ARTIFACTS.filter((a) => a.location === location && a.rarity === rarity);
  if (pool.length === 0) return ARTIFACTS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}