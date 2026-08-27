import { monotonicFactory } from "ulidx";

/**
 * ULID generation with an explicit PRNG, because ulidx's auto-detection
 * fails on React Native (Hermes has no Web Crypto). Web and Node use real
 * crypto; RN falls back to Math.random — fine here, since vault ULIDs need
 * uniqueness and sortability, not cryptographic secrecy.
 *
 * monotonicFactory also guarantees same-millisecond IDs strictly increase,
 * which keeps insertion order stable everywhere IDs are sorted.
 */
interface CryptoLike {
  getRandomValues?: (buf: Uint32Array) => Uint32Array;
}

function prng(): number {
  const cryptoObj = (globalThis as { crypto?: CryptoLike }).crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return (buf[0] ?? 0) / 0xffffffff;
  }
  return Math.random();
}

export const newUlid: () => string = monotonicFactory(prng);
