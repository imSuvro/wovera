import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  entropyToMnemonic as bip39EntropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

/**
 * The vault's zero-knowledge layer.
 *
 * Model (locked by product decision): a random 128-bit root entropy lives on
 * the device; its BIP39 mnemonic — twelve English words — is shown ONCE as
 * the recovery phrase. The actual encryption key is derived via HKDF, so the
 * words on paper and the key in storage are the same secret in two clothes.
 * The server only ever sees XChaCha20-Poly1305 ciphertext.
 *
 * Losing every device AND the twelve words means the vault is gone forever.
 * That is not a bug; it is what "nobody else can read it" costs.
 */

const KEY_INFO = "wovera-vault-key-v1";

export interface VaultCipherEnvelope {
  /** base64: 24-byte XChaCha20 nonce. */
  n: string;
  /** base64: ciphertext + Poly1305 tag. */
  c: string;
  /** envelope version for future migrations. */
  v: 1;
}

interface RngCrypto {
  getRandomValues?: (buf: Uint8Array) => Uint8Array;
}

function randomBytes(length: number): Uint8Array {
  const cryptoObj = (globalThis as { crypto?: RngCrypto }).crypto;
  if (!cryptoObj?.getRandomValues) throw new Error("secure-rng-unavailable");
  const buf = new Uint8Array(length);
  cryptoObj.getRandomValues(buf);
  return buf;
}

export function entropyToMnemonic(entropy: Uint8Array): string {
  if (entropy.length !== 16) throw new Error("entropy must be 16 bytes");
  return bip39EntropyToMnemonic(entropy, wordlist); // 16 bytes → 12 words
}

export function mnemonicToRootEntropy(mnemonic: string): Uint8Array | null {
  const normalized = mnemonic.trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(normalized, wordlist)) return null;
  return mnemonicToEntropy(normalized, wordlist);
}

/** Fresh setup: root entropy + its twelve words in one call. */
export function createRecovery(): { entropy: Uint8Array; mnemonic: string } {
  const entropy = randomBytes(16);
  return { entropy, mnemonic: entropyToMnemonic(entropy) };
}

/** Convenience for tests and previews. */
export function randomMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

export function deriveVaultKey(entropy: Uint8Array): Uint8Array {
  return hkdf(sha256, entropy, undefined, utf8ToBytes(KEY_INFO), 32);
}

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = new Map([...B64_ALPHABET].map((ch, i) => [ch, i]));

/** Dependency-free base64 — identical on Hermes, browsers, and Node. */
function toB64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64_ALPHABET[a >> 2];
    out += B64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64_ALPHABET[c & 63];
  }
  return out;
}

function fromB64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let idx = 0;
  for (const ch of clean) {
    const val = B64_LOOKUP.get(ch);
    if (val === undefined) throw new Error("bad base64");
    acc = (acc << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function encryptJson(key: Uint8Array, value: unknown): VaultCipherEnvelope {
  const nonce = randomBytes(24);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);
  return { n: toB64(nonce), c: toB64(ciphertext), v: 1 };
}

/** Throws on wrong key or tampered ciphertext — Poly1305 authenticates. */
export function decryptJson<T>(key: Uint8Array, envelope: VaultCipherEnvelope): T {
  const plaintext = xchacha20poly1305(key, fromB64(envelope.n)).decrypt(fromB64(envelope.c));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export function entropyToHex(entropy: Uint8Array): string {
  return [...entropy].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToEntropy(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
