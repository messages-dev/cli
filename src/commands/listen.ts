import { defineCommand } from "../cli";
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { signWebhook } from "@messages-dev/sdk";
import { CONVEX_URL, USER_AGENT } from "../api";
import { getAuthedClient } from "../client";
import { BIN } from "../meta";
import { fail, jsonMode } from "../errors";
import { bold, cyan, dim, gray, green, magenta, red, yellow } from "../style";

type Event = {
  event: string;
  timestamp: number;
  data: Record<string, unknown>;
};

// Hand-rolled reference to `events:subscribeForApiKey`, the Convex query the
// daemon emits SSE events through. Avoids depending on the workspace
// `@messages-dev/convex` package so this CLI builds standalone in its public
// mirror.
const subscribeForApiKey = makeFunctionReference<
  "query",
  { apiKey: string; since: number; events?: string[]; lineIds?: string[] },
  readonly Event[]
>("events:subscribeForApiKey");

export default defineCommand({
  meta: {
    name: "listen",
    description:
      "Stream message events live. Defaults to NDJSON to stdout; with --forward-to, POSTs HMAC-signed events to the given URL like a real webhook.",
  },
  args: {
    "forward-to": {
      type: "string",
      description: "POST events to this URL with X-Webhook-Signature headers.",
      alias: "f",
    },
    secret: {
      type: "string",
      description:
        "HMAC secret for --forward-to signatures (defaults to MESSAGES_LISTEN_SECRET or a random per-session secret printed at start).",
    },
    event: {
      type: "string",
      description: "Repeatable event name to filter (default: all message events).",
    },
    line: {
      type: "string",
      description:
        "Phone-number handle (e.g. +14155551234) or line id. Repeatable. Defaults to all lines accessible to your key.",
    },
    since: {
      type: "string",
      description: "Unix-ms timestamp to start streaming from (default: now - 60s).",
    },
    json: { type: "boolean", description: "Always emit JSON; no human prefix." },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const authed = await getAuthedClient({ json });

    const events = Array.isArray(args.event) ? (args.event as string[]) : args.event ? [args.event as string] : undefined;
    const lineArgs = Array.isArray(args.line) ? (args.line as string[]) : args.line ? [args.line as string] : [];
    const initialSince = args.since ? parseInt(args.since as string, 10) : Date.now() - 60_000;

    // Resolve handles/prefixed ids to the raw Convex `_id` shape that the
    // `events:subscribeForApiKey` query expects (`v.id("lines")`). The HTTP API
    // already org-scopes the result, so listLines() doubles as the source of
    // truth for "what can this key see". Subscribing without --line streams
    // events for every accessible line; the backend re-validates anyway.
    const linesPage = await authed.client.listLines();
    const byHandle = new Map<string, string>();
    const byId = new Map<string, string>();
    const allRawIds: string[] = [];
    for (const ln of linesPage.data) {
      const raw = stripPrefix(ln.id);
      byHandle.set(ln.handle, raw);
      byId.set(ln.id, raw);
      byId.set(raw, raw);
      allRawIds.push(raw);
    }

    let lineIds: string[] | undefined;
    if (lineArgs.length > 0) {
      const resolved: string[] = [];
      for (const arg of lineArgs) {
        const raw = byHandle.get(arg) ?? byId.get(arg);
        if (!raw) {
          fail(
            "not_found",
            `Line not found or not accessible to your key: ${arg}. Run \`${BIN} lines list\` to see options.`,
            { json },
          );
        }
        resolved.push(raw);
      }
      lineIds = resolved;
    } else {
      lineIds = allRawIds.length > 0 ? allRawIds : undefined;
    }

    const forwardTo = (args["forward-to"] as string | undefined) ?? (args.forwardTo as string | undefined);
    const forwardSecret =
      (args.secret as string | undefined) ??
      process.env.MESSAGES_LISTEN_SECRET ??
      (forwardTo ? generateSecret() : "");
    if (forwardTo && !args.secret && !process.env.MESSAGES_LISTEN_SECRET) {
      console.error(`# generated session HMAC secret (set MESSAGES_LISTEN_SECRET to reuse):`);
      console.error(`#   ${forwardSecret}`);
    }

    const convex = new ConvexClient(CONVEX_URL);
    const seen = new Set<string>();
    let cursor = initialSince;

    if (!json) {
      if (forwardTo) {
        console.error(`Forwarding events to ${forwardTo} (Ctrl-C to stop).`);
      } else {
        console.error(gray(`Streaming events (Ctrl-C to stop). Use --forward-to <url> to deliver as signed webhooks.`));
      }
    }

    // Convex de-duplicates concurrent subscribers but doesn't expose a clean
    // "stop" handle for one-shot CLIs without onUpdate's unsubscribe fn.
    const unsubscribe = convex.onUpdate(
      subscribeForApiKey,
      {
        apiKey: authed.apiKey,
        since: cursor,
        ...(events ? { events } : {}),
        ...(lineIds ? { lineIds } : {}),
      },
      async (rowsRaw) => {
        const rows = rowsRaw as readonly Event[];
        for (const evt of rows) {
          // Convex re-runs the query on dependency change, returning the
          // entire window. De-dupe by data.id when present.
          const id = (evt.data?.id as string | undefined) ?? `${evt.event}:${evt.timestamp}`;
          if (seen.has(id)) continue;
          seen.add(id);
          if (evt.timestamp > cursor) cursor = evt.timestamp;

          if (forwardTo) {
            await deliver(forwardTo, forwardSecret, evt);
          } else if (json) {
            process.stdout.write(JSON.stringify(evt) + "\n");
          } else {
            process.stdout.write(formatEvent(evt) + "\n");
          }
        }
      },
      (err) => {
        console.error(`subscription error: ${err.message}`);
      },
    );

    const shutdown = () => {
      try {
        unsubscribe();
      } catch {}
      void convex.close().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep the process alive.
    await new Promise(() => {});
  },
});

function stripPrefix(id: string): string {
  return id.startsWith("ln_") ? id.slice(3) : id;
}

// iMessage uses U+FFFC (object replacement) as a placeholder for inline
// attachments. Treat a body of just FFFCs as "no text" so the attachment
// summary stands on its own.
const ATTACHMENT_PLACEHOLDER = /^￼+$/;
const MAX_TEXT_LEN = 100;

function formatEvent(evt: Event): string {
  const ts = new Date(evt.timestamp);
  const hh = String(ts.getHours()).padStart(2, "0");
  const mm = String(ts.getMinutes()).padStart(2, "0");
  const ss = String(ts.getSeconds()).padStart(2, "0");
  const time = dim(`${hh}:${mm}:${ss}`);

  const name = colorEventName(evt.event);
  if (evt.event.startsWith("message.")) {
    return `${time}  ${name}  ${formatMessage(evt.data)}`;
  }
  if (evt.event.startsWith("reaction.")) {
    return `${time}  ${name}  ${formatReaction(evt.event, evt.data)}`;
  }
  return `${time}  ${name}  ${dim(JSON.stringify(evt.data))}`;
}

function colorEventName(name: string): string {
  if (name === "message.received") return cyan(bold(name));
  if (name === "message.sent") return green(bold(name));
  if (name.endsWith(".failed")) return red(bold(name));
  if (name.startsWith("reaction.")) return magenta(bold(name));
  return yellow(bold(name));
}

// Convex emits snake_case data on the wire; SDK consumers see camelCase
// post-`verifyWebhook`. Read both shapes defensively.
function readField(data: Record<string, unknown>, key: string): unknown {
  return data[key] ?? data[snakeToCamel(key)];
}

function formatMessage(data: Record<string, unknown>): string {
  const peer = String(readField(data, "sender") ?? "?");
  const peerLabel = dim(peer);

  const rawText = readField(data, "text");
  const text =
    typeof rawText === "string" && rawText.length > 0 && !ATTACHMENT_PLACEHOLDER.test(rawText)
      ? rawText
      : "";
  const truncated = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN - 1) + "…" : text;

  const attachmentSummary = summarizeAttachments(data);
  const isAudio = Boolean(readField(data, "is_audio_message"));

  const parts: string[] = [];
  if (isAudio) parts.push(dim("🎙 voice"));
  else if (attachmentSummary) parts.push(dim(attachmentSummary));
  if (truncated) parts.push(truncated);
  if (parts.length === 0) parts.push(dim("(empty)"));

  return `${peerLabel}  ${parts.join("  ")}`;
}

function summarizeAttachments(data: Record<string, unknown>): string | null {
  const raw = readField(data, "attachments");
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0] as Record<string, unknown> | undefined;
  const mime = first ? String(readField(first, "mime_type") ?? "") : "";
  const filename = first ? String(readField(first, "filename") ?? "") : "";
  const label = filename
    ? filename.split("/").pop() || filename
    : mime || "attachment";
  return raw.length > 1 ? `📎 ${label} +${raw.length - 1}` : `📎 ${label}`;
}

function formatReaction(eventName: string, data: Record<string, unknown>): string {
  const type = String(readField(data, "type") ?? "?");
  const sender = String(readField(data, "sender") ?? "?");
  const messageId = String(readField(data, "message_id") ?? "?");
  const verb = eventName === "reaction.removed" ? "removed" : "added";
  return `${dim(sender)}  ${verb} ${bold(type)} on ${cyan(messageId)}`;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function generateSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

async function deliver(url: string, secret: string, evt: Event): Promise<void> {
  const timestamp = Date.now();
  const deliveryId = `dlv_local_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
  const body = JSON.stringify({
    event: evt.event,
    data: evt.data,
    timestamp,
    delivery_id: deliveryId,
  });
  const signature = await signWebhook(secret, timestamp, body);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": String(timestamp),
          "X-Webhook-Delivery-Id": deliveryId,
        },
        body,
      });
      if (res.ok) {
        process.stderr.write(`-> ${url} ${res.status} ${evt.event}\n`);
        return;
      }
      process.stderr.write(`-> ${url} ${res.status} ${evt.event} (attempt ${attempt + 1}/3)\n`);
    } catch (err) {
      process.stderr.write(
        `-> ${url} error: ${err instanceof Error ? err.message : String(err)} (attempt ${attempt + 1}/3)\n`,
      );
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}
