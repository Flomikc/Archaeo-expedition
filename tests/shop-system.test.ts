import { describe, it, expect } from "vitest";
import { ShopSystem } from "../src/systems/ShopSystem";
import { SaveSystem } from "../src/systems/SaveSystem";
import { ValidationError, ShopError } from "../src/systems/errors";

describe("ShopSystem", () => {
  it("покупка отмычки списывает 50 монет", () => {
    const result = ShopSystem.buy("lockpick");
    expect(result.ok).toBe(true);
    expect(SaveSystem.get().coins).toBe(0);
  });

  it("возвращает reason при недостатке монет", () => {
    const result = ShopSystem.buy("drill_upgrade");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Мало монет");
  });

  it("не даёт купить уникальный предмет повторно", () => {
    ShopSystem.buy("lockpick");
    SaveSystem.addCoins(1000);
    const result = ShopSystem.buy("lockpick");
    expect(result.reason).toBe("Уже куплено");
  });

  it("бросает ValidationError при пустом id", () => {
    expect(() => ShopSystem.buy("")).toThrow(ValidationError);
  });

  it("бросает ShopError для неизвестного id", () => {
    expect(() => ShopSystem.buy("nope")).toThrow(ShopError);
  });

  it("consume уменьшает количество", () => {
    SaveSystem.addCoins(1000);
    ShopSystem.buy("medkit");
    expect(ShopSystem.consume("medkit")).toBe(true);
    expect(ShopSystem.ownedCount("medkit")).toBe(0);
  });

  it("consume возвращает false без остатка", () => {
    expect(ShopSystem.consume("medkit")).toBe(false);
  });
});