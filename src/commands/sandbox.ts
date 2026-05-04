import QRCode from "qrcode";
import { defineCommand } from "../cli";
import { resolveCreds } from "../auth/creds";
import { API_URL, USER_AGENT } from "../api";
import { fail, jsonMode, toMessage } from "../errors";
import { emit } from "../output";
import { bold, dim, gray, green } from "../style";
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

function printActiveSummary(s: SandboxResponse): void {
  console.log(`${green("✓")} ${bold("Sandbox active")}`);
  console.log(`    ${dim("Sandbox line  ")}  ${s.sandbox_line_handle}`);
  console.log(`    ${dim("Paired with   ")}  ${s.contact_identifier ?? "—"}`);
  console.log(`    ${dim("Usage today   ")}  ${renderUsageLine(s.usage)}`);
}

async function renderQrCode(text: string): Promise<string> {
  return QRCode.toString(text, { type: "terminal", small: true, errorCorrectionLevel: "M" });
}

/**
 * Shared activation flow. Used by `signup` and `sandbox activate`. Returns
 * the final sandbox state once active, or null on timeout (caller decides
 * how to message the timeout).
 */
export async function activateInteractively(json: boolean): Promise<SandboxResponse | null> {
  const initial = await ensureSandbox(json);
  if (initial.status === "active") {
    if (json) {
      console.log(JSON.stringify(initial, null, 2));
    } else {
      console.log(dim("Sandbox already active."));
      printActiveSummary(initial);
    }
    return initial;
  }

  if (json) {
    // Stream both states in JSON mode: first the pending sandbox so scripts
    // can read the activation_code, then the polled-active result on a new
    // line. NDJSON-ish; downstream tools can read just the first line if
    // they don't want to wait.
    console.log(JSON.stringify(initial, null, 2));
  } else {
    if (!initial.activation_code) {
      fail("generic", "Server did not return an activation code.", { json });
    }
    const code = initial.activation_code!;
    const number = initial.sandbox_line_handle;
    const smsUri = `sms:${number}?body=${encodeURIComponent(code)}`;

    console.log(`${bold("Activate your sandbox")}`);
    console.log("");
    console.log(`  Text  ${bold(code)}  to  ${bold(number)}  from your phone.`);
    console.log("");
    const qr = await renderQrCode(smsUri).catch(() => null);
    if (qr) {
      // qrcode's terminal output already includes leading whitespace per row;
      // trim trailing blank lines so the prompt sits closer to the QR.
      console.log(qr.replace(/\n+$/, ""));
      console.log(`  ${dim("Scan to open the pre-filled SMS draft on a nearby phone.")}`);
      console.log("");
    }
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
        printActiveSummary(state);
        console.log("");
        console.log(`  ${dim(`Try it:`)} ${BIN} send ${state.contact_identifier} "hello from the sandbox"`);
      }
      return state;
    }
  }

  if (!json) {
    console.log("");
    console.log(`${dim("Timed out waiting for activation. Re-check with")} ${BIN} sandbox status.`);
  }
  return null;
}

const status = defineCommand({
  meta: { name: "status", description: "Show sandbox status, paired number, and usage." },
  args: { json: { type: "boolean" } },
  async run({ args }) {
    const json = jsonMode(args);
    try {
      const s = await readSandbox(json);
      if (json) {
        emit(s, json);
        return;
      }
      if (s.status === "missing") {
        console.log(dim("No sandbox yet. Run `") + BIN + dim(" sandbox activate` to create one."));
        return;
      }
      if (s.status === "pending") {
        console.log(`${bold("Sandbox pending activation")}`);
        console.log(`    ${dim("Code         ")}  ${s.activation_code ?? "—"}`);
        console.log(`    ${dim("Send to      ")}  ${s.sandbox_line_handle}`);
        console.log("");
        console.log(`  ${dim("Run")} ${BIN} sandbox activate ${dim("for the QR code and to wait for activation.")}`);
        return;
      }
      printActiveSummary(s);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const activate = defineCommand({
  meta: {
    name: "activate",
    description: "Create a sandbox if needed, print the activation code, and wait for the SMS handshake.",
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
  meta: { name: "sandbox", description: "Manage your messages.dev sandbox (status, activate)." },
  subCommands: { status, activate },
  // Default to status when no subcommand is given.
  async run({ args }) {
    await status.run!({ args });
  },
});

