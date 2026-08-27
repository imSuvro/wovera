import { describe, expect, it } from "vitest";
import { newUlid } from "./ids";

describe("newUlid", () => {
  it("produces valid, unique, monotonically increasing ULIDs", () => {
    const ids = Array.from({ length: 500 }, () => newUlid());
    for (const id of ids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Set(ids).size).toBe(500);
    // Monotonic factory: same-ms IDs still sort in creation order.
    expect([...ids].sort()).toEqual(ids);
  });
});
