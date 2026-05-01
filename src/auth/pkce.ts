function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBase64Url(32);
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return { verifier, challenge: base64url(new Uint8Array(hash)) };
}
