import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, chmod, unlink } from "node:fs/promises";

const DIR = join(homedir(), ".messages");
const FILE = join(DIR, "config.json");

export type StoredProfile = {
  apiKey: string;
  prefix: string;
  email: string | null;
  orgId: string;
  createdAt: number;
};

export type Config = {
  profiles: Record<string, StoredProfile>;
  defaultProfile: string;
};

export function configPath(): string {
  return FILE;
}

export async function loadConfig(): Promise<Config | null> {
  const file = Bun.file(FILE);
  if (!(await file.exists())) return null;
  try {
    const data = (await file.json()) as Config;
    if (!data.profiles || !data.defaultProfile) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveProfile(name: string, profile: StoredProfile): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const existing = (await loadConfig()) ?? { profiles: {}, defaultProfile: name };
  existing.profiles[name] = profile;
  existing.defaultProfile = name;
  await Bun.write(FILE, JSON.stringify(existing, null, 2));
  await chmod(FILE, 0o600);
}

export async function clearConfig(): Promise<boolean> {
  try {
    await unlink(FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve credentials for the current invocation.
 *
 * Precedence: explicit `MESSAGES_API_KEY` env var → stored profile.
 * Returns null when neither is present so callers can prompt the user.
 */
export async function resolveCreds(): Promise<{
  apiKey: string;
  source: "env" | "config";
  profile?: StoredProfile;
} | null> {
  const env = process.env.MESSAGES_API_KEY;
  if (env && env.startsWith("sk_live_")) {
    return { apiKey: env, source: "env" };
  }
  const cfg = await loadConfig();
  if (!cfg) return null;
  const profile = cfg.profiles[cfg.defaultProfile];
  if (!profile) return null;
  return { apiKey: profile.apiKey, source: "config", profile };
}
