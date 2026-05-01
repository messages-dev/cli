import { test, expect } from "bun:test";
import { pkcePair, randomBase64Url } from "../src/auth/pkce";

test("randomBase64Url returns the expected length and charset", () => {
  const out = randomBase64Url(32);
  expect(out).toMatch(/^[A-Za-z0-9_-]+$/);
  // 32 bytes -> 43 base64url chars (no padding).
  expect(out.length).toBe(43);
});

test("pkcePair produces a verifier and a SHA-256 challenge", async () => {
  const { verifier, challenge } = await pkcePair();
  expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(verifier.length).toBe(43);
  expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(challenge.length).toBe(43);

  // Recompute the challenge and confirm match.
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const expected = Buffer.from(new Uint8Array(hash))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  expect(challenge).toBe(expected);
});

test("each pkcePair returns a fresh verifier", async () => {
  const a = await pkcePair();
  const b = await pkcePair();
  expect(a.verifier).not.toBe(b.verifier);
  expect(a.challenge).not.toBe(b.challenge);
});
