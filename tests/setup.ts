import { beforeEach } from "vitest";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});