import { describe, expect, it } from "vitest";
import { decodeHlc, encodeHlc, hlcMerge, hlcNext } from "./hlc";

describe("hybrid logical clock", () => {
  it("advances with physical time", () => {
    const a = hlcNext({ ms: 100, count: 3, device: "dev-a" }, 200);
    expect(a).toEqual({ ms: 200, count: 0, device: "dev-a" });
  });

  it("counts within the same millisecond and never goes backwards", () => {
    let clock = { ms: 100, count: 0, device: "dev-a" };
    clock = hlcNext(clock, 100);
    clock = hlcNext(clock, 50); // wall clock jumped backwards
    expect(clock).toEqual({ ms: 100, count: 2, device: "dev-a" });
  });

  it("encodes to strings whose lexical order is causal order", () => {
    const stamps = [
      { ms: 999, count: 40, device: "b" },
      { ms: 1000, count: 0, device: "a" },
      { ms: 1000, count: 1, device: "a" },
      { ms: 1000, count: 1, device: "b" }, // device breaks the tie
      { ms: 1001, count: 0, device: "a" },
    ];
    const encoded = stamps.map(encodeHlc);
    expect([...encoded].sort()).toEqual(encoded);
  });

  it("round-trips through encode/decode, including devices with dashes", () => {
    const hlc = { ms: 1725000000000, count: 37, device: "dev-a-1" };
    expect(decodeHlc(encodeHlc(hlc))).toEqual(hlc);
  });

  it("merges a remote stamp ahead of local time", () => {
    const merged = hlcMerge(
      { ms: 100, count: 5, device: "a" },
      { ms: 500, count: 9, device: "b" },
      120,
    );
    expect(merged.ms).toBe(500);
    expect(merged.count).toBe(10);
    expect(merged.device).toBe("a");
    // A subsequent local event still sorts after everything merged.
    const next = hlcNext(merged, 130);
    expect(encodeHlc(next) > encodeHlc({ ms: 500, count: 9, device: "b" })).toBe(true);
  });
});
