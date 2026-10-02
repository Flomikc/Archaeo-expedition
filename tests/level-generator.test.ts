import { describe, it, expect } from "vitest";
import { NullEngine, Scene } from "@babylonjs/core";
import { LevelGenerator } from "../src/systems/LevelGenerator";

describe("LevelGenerator", () => {
  it("генерирует уровень с одинаковым seed одинаково", () => {
    const engine = new NullEngine();
    const gen = new LevelGenerator();
    const l1 = gen.build(new Scene(engine), 12345);
    const l2 = gen.build(new Scene(engine), 12345);
    expect(l1.nodes.length).toBe(l2.nodes.length);
    engine.dispose();
  });

  it("разные seed дают разные планировки", () => {
    const engine = new NullEngine();
    const gen = new LevelGenerator();
    const l1 = gen.build(new Scene(engine), 111);
    const l2 = gen.build(new Scene(engine), 222);
    const p1 = l1.nodes.map(n => `${n.centerX},${n.centerZ}`).join("|");
    const p2 = l2.nodes.map(n => `${n.centerX},${n.centerZ}`).join("|");
    expect(p1).not.toBe(p2);
    engine.dispose();
  });

  it("старт на 0 этаже, цель выше", () => {
    const engine = new NullEngine();
    const level = new LevelGenerator().build(new Scene(engine), 777);
    expect(level.start.cell.floor).toBe(0);
    expect(level.goal.cell.floor).toBeGreaterThanOrEqual(1);
    engine.dispose();
  });
});