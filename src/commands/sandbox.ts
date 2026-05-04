import QRCode from "qrcode";
import { defineCommand } from "../cli";
import { resolveCreds } from "../auth/creds";
import { API_URL, USER_AGENT } from "../api";
import { fail, jsonMode, toMessage } from "../errors";
import { emit } from "../output";
import { bold, dim, gray, green, yellow } from "../style";
import { BIN } from "../meta";

type SandboxResponse = {
  status: "missing" | "pending" | "active";
  activation_code: string | null;
  sandbox_line_handle: string;
  contact_identifier: string | null;
  activated_at: number | null;
  usage: { used: number; limit: number; remaining: number; resets_at: number };
  request_id: string;
};

async function authedFetch(
  path: string,
  init: RequestInit & { json?: boolean } = {},
): Promise<Response> {
  const creds = await resolveCreds();
  if (!creds) {
    fail(
      "not_authenticated",
      `Not signed in. Run \`${BIN} login\` (or \`${BIN} signup\`), or set MESSAGES_API_KEY.`,
      { json: !!init.json },
    );
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.apiKey}`,
    "User-Agent": USER_AGENT,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_URL.replace(/\/$/, "")}${path}`, { ...init, headers });
}

async function readSandbox(json: boolean): Promise<SandboxResponse> {
  const res = await authedFetch("/v1/sandbox", { method: "GET", json });
  return await parseSandboxBody(res, json);
}

async function ensureSandbox(json: boolean): Promise<SandboxResponse> {
  const res = await authedFetch("/v1/sandbox", { method: "POST", json });
  return await parseSandboxBody(res, json);
}

async function deactivateSandbox(json: boolean): Promise<SandboxResponse> {
  const res = await authedFetch("/v1/sandbox", { method: "DELETE", json });
  return await parseSandboxBody(res, json);
}

async function parseSandboxBody(res: Response, json: boolean): Promise<SandboxResponse> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    fail("generic", `Unexpected response (${res.status}): ${text.slice(0, 200)}`, { json });
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error;
    fail("generic", err?.message ?? `Request failed (${res.status})`, { json });
  }
  return body as SandboxResponse;
}

function renderUsageLine(u: SandboxResponse["usage"]): string {
  const width = 20;
  const filled = Math.min(width, Math.round((u.used / Math.max(1, u.limit)) * width));
  const bar = "█".repeat(filled) + dim("·".repeat(width - filled));
  const reset = new Date(u.resets_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${bar}  ${u.used}/${u.limit}   ${dim(`resets ${reset}`)}`;
}

async function renderQrCode(text: string): Promise<string | null> {
  try {
    return await QRCode.toString(text, {
      type: "terminal",
      small: true,
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

/**
 * Print the dashboard-style sandbox card. Mirrors the SandboxCard component
 * in apps/app/src/pages/dashboard.tsx: header line ("Activate your sandbox"
 * vs. "Sandbox active"), the QR code + code-to-text instructions when
 * pending, and a usage row when active.
 */
async function printSandboxCard(s: SandboxResponse): Promise<void> {
  if (s.status === "active") {
    console.log(`${green("✓")} ${bold("Sandbox active")}`);
    console.log("");
    console.log(`  ${dim("Sandbox line  ")}  ${s.sandbox_line_handle}`);
    console.log(`  ${dim("Paired with   ")}  ${s.contact_identifier ?? "—"}`);
    console.log(`  ${dim("Usage today   ")}  ${renderUsageLine(s.usage)}`);
    return;
  }

  if (s.status === "missing" || !s.activation_code) {
    console.log(`${dim("No sandbox yet. Run")} ${BIN} sandbox activate ${dim("to create one.")}`);
    return;
  }

  const code = s.activation_code;
  const number = s.sandbox_line_handle;
  const smsUri = `sms:${number}?body=${encodeURIComponent(code)}`;

  console.log(`${yellow("●")} ${bold("Activate your sandbox")}`);
  console.log("");
  console.log(`  ${dim("Step 1")}  Scan this QR from your phone (or text the code manually):`);
  console.log("");

  const qr = await renderQrCode(smsUri);
  if (qr) {
    // qrcode's terminal output already pads each row; trim the trailing
    // blank lines so the rest of the card sits flush.
    console.log(qr.replace(/\n+$/, ""));
    console.log("");
  }

  console.log(`  ${dim("Step 2")}  Text  ${bold(code)}  to  ${bold(number)}.`);
  console.log("");
}

/**
 * Shared activation flow. Used by `signup` and `sandbox activate`. Renders
 * the dashboard card, then polls until the sandbox flips to active. Returns
 * the final state on success, or null on timeout.
 */
export async function activateInteractively(json: boolean): Promise<SandboxResponse | null> {
  const initial = await ensureSandbox(json);
  if (initial.status === "active") {
    if (json) {
      console.log(JSON.stringify(initial, null, 2));
    } else {
      console.log(dim("Sandbox already active."));
      await printSandboxCard(initial);
    }
    return initial;
  }

  if (json) {
    // NDJSON-ish: print the pending state first so scripts can read the
    // activation_code, then the polled active state on a new line.
    console.log(JSON.stringify(initial, null, 2));
  } else {
    await printSandboxCard(initial);
    console.log(`  ${gray("Waiting for activation…")}  ${dim("(Ctrl-C to cancel)")}`);
  }

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const state = await readSandbox(json);
    if (state.status === "active") {
      if (json) {
        console.log(JSON.stringify(state, null, 2));
      } else {
        console.log("");
        await printSandboxCard(state);
        console.log("");
        console.log(`  ${dim(`Try it:`)} ${BIN} send ${state.contact_identifier} "hello from the sandbox"`);
      }
      return state;
    }
  }

  if (!json) {
    console.log("");
    console.log(`${dim("Timed out waiting for activation. Re-check with")} ${BIN} sandbox.`);
  }
  return null;
}

const status = defineCommand({
  meta: { name: "status", description: "Show the sandbox state (read-only; does not create one)." },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const s = await readSandbox(json);
      if (json) {
        emit(s, json);
        return;
      }
      await printSandboxCard(s);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const deactivate = defineCommand({
  meta: {
    name: "deactivate",
    description: "Clear the current pairing and roll a fresh activation code.",
  },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const s = await deactivateSandbox(json);
      if (json) {
        emit(s, json);
        return;
      }
      console.log(`${dim("Sandbox deactivated. New activation code:")} ${bold(s.activation_code ?? "—")}`);
      console.log("");
      await printSandboxCard(s);
      console.log(
        `  ${dim("Run")} ${BIN} sandbox activate ${dim("to pair a phone again.")}`,
      );
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const activate = defineCommand({
  meta: {
    name: "activate",
    description: "Create a sandbox if needed, render the QR card, and wait for the SMS handshake.",
  },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const final = await activateInteractively(json);
      if (!final) process.exit(1);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: {
    name: "sandbox",
    description: "Show your sandbox card (state + QR if pending). Use `activate` to also wait for the handshake.",
  },
  subCommands: { status, activate, deactivate },
  args: { json: { type: "boolean" } },
  // Bare `messages-dev sandbox` mirrors the dashboard's SandboxCard:
  // ensure a sandbox row exists, then render the card. No polling — that's
  // what `sandbox activate` is for.
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const s = await ensureSandbox(json);
      if (json) {
        emit(s, json);
        return;
      }
      await printSandboxCard(s);
      if (s.status === "pending") {
        console.log(
          `  ${dim("Run")} ${BIN} sandbox activate ${dim("to wait here until activation completes.")}`,
        );
      }
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
