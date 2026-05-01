// Hand-rolled help renderer. Citty's auto-generated help has a custom shape
// (USAGE on one line, repeated version headers, no grouping); we bypass it
// and render in the agent-browser style: short blurb, `Usage:` line,
// `Title Case:` section headers, two-space-aligned columns.

import { VERSION, BIN } from "./meta";

type Section = {
  title: string;
  // When set, rendered as "Title:  <usagePrefix>" so the section header itself
  // doubles as a usage hint for sub-namespaced commands.
  usagePrefix?: string;
  items: { name: string; desc: string }[];
};

type Block = {
  title: string;
  // Free-form lines rendered under the title. Each string becomes one line,
  // pre-indented with two spaces. Empty strings render blank lines.
  lines: string[];
};

type RootSpec = {
  blurb: string;
  usage: string;
  sections: Section[];
  options: { flags: string; desc: string }[];
  // Trailing prose blocks: Authentication, Output, Exit codes. Rendered after
  // Options. Designed primarily for agents discovering the contract from
  // `--help` alone.
  blocks: Block[];
};

type CommandSpec = {
  blurb: string;
  usage: string;
  args?: { name: string; desc: string }[];
  options?: { flags: string; desc: string }[];
  examples?: string[];
};

const ROOT: RootSpec = {
  blurb: `${BIN} - send and receive iMessages from your terminal`,
  usage: `${BIN} <command> [args] [options]`,
  sections: [
    {
      title: "Core Commands",
      items: [
        { name: "login", desc: "Sign in to your messages.dev account" },
        { name: "logout", desc: "Sign out" },
      ],
    },
    {
      title: "Messaging",
      items: [
        { name: "send <to> [text]", desc: "Send a text, media, or audio message" },
        { name: "react <msg-id> <emoji>", desc: "Send a tapback reaction" },
        { name: "typing <to>", desc: "Send a typing indicator (--off to clear)" },
        { name: "read <to>", desc: "Send a read receipt" },
      ],
    },
    {
      title: "Resources",
      items: [
        { name: "lines list", desc: "List your phone lines" },
        { name: "chats list", desc: "List chats on a line" },
        { name: "messages list", desc: "List messages in a chat" },
        { name: "messages get <id>", desc: "Show a single message" },
        { name: "reactions list", desc: "List reactions on a message" },
        { name: "receipts list", desc: "List read receipts" },
        { name: "outbox get <id>", desc: "Inspect an outbound item" },
      ],
    },
    {
      title: "Files",
      usagePrefix: `${BIN} files <action>`,
      items: [
        { name: "upload <path>", desc: "Upload a file, prints file_…" },
        { name: "get <id>", desc: "Print a download URL (or stream with --download)" },
      ],
    },
    {
      title: "Webhooks",
      usagePrefix: `${BIN} webhooks <action>`,
      items: [
        { name: "list", desc: "List webhook subscriptions" },
        { name: "create", desc: "Create a webhook (--url, --event, --line)" },
        { name: "delete <id>", desc: "Delete a webhook" },
      ],
    },
    {
      title: "Typing",
      usagePrefix: `${BIN} typing <action>`,
      items: [
        { name: "list", desc: "List typing indicators" },
      ],
    },
    {
      title: "Developer",
      items: [
        { name: "listen", desc: "Stream events; --forward-to posts signed webhooks locally" },
      ],
    },
  ],
  options: [
    { flags: "--json", desc: "Emit JSON (also: MESSAGES_OUTPUT=json)" },
    { flags: "--from <handle>", desc: "Sending line (used by send/react/typing/read)" },
    { flags: "--line <handle>", desc: "Scope to a line (used by list commands)" },
    { flags: "--help", desc: "Show help for a command" },
    { flags: "--version", desc: "Print version" },
  ],
  blocks: [
    {
      title: "Authentication",
      lines: [
        `Set MESSAGES_API_KEY=sk_live_… for non-interactive use, or run`,
        `\`${BIN} login\` once to store credentials in ~/.messages/config.json.`,
      ],
    },
    {
      title: "Output",
      lines: [
        `Default is human-readable. Pass --json (or set MESSAGES_OUTPUT=json) for`,
        `structured output on every command. Errors go to stderr; with --json`,
        `they take the shape {"error":{"code":"…","message":"…"}}.`,
      ],
    },
    {
      title: "Exit codes",
      lines: [
        `0 ok   1 generic   2 usage   3 not_authenticated   4 not_found   5 validation`,
      ],
    },
  ],
};

const COMMANDS: Record<string, CommandSpec> = {
  login: {
    blurb: "sign in to your messages.dev account",
    usage: `${BIN} login [options]`,
    options: [
      { flags: "--org <id>", desc: "Skip the org picker and use this organization (org_…)" },
    ],
    examples: [
      `${BIN} login`,
      `${BIN} login --org org_abc123`,
      `# headless: skip login entirely`,
      `MESSAGES_API_KEY=sk_live_… ${BIN} lines list`,
    ],
  },

  logout: {
    blurb: "sign out and remove stored credentials",
    usage: `${BIN} logout`,
    examples: [`${BIN} logout`],
  },

  send: {
    blurb: "send a text, media, or audio message",
    usage: `${BIN} send <to> [text] [options]`,
    args: [
      { name: "<to>", desc: "Recipient: phone number (+14155551234) or Apple ID (user@icloud.com)" },
      { name: "[text]", desc: "Message body. If omitted, read from stdin when piped." },
    ],
    options: [
      { flags: "--from <handle>", desc: "Sending line handle (run `lines list`). Defaults to the only active line if you have one." },
      { flags: "--attach <file>", desc: "File id (file_…) to attach. Repeatable. Upload with `files upload`." },
      { flags: "--reply-to <id>", desc: "Reply to a message id (msg_…) or imsgGuid" },
      { flags: "--audio <path>", desc: "Send a voice memo from a local audio file (m4a/wav/mp3)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} send +14155551234 "hi there"`,
      `echo "hi" | ${BIN} send +14155551234`,
      `${BIN} send user@icloud.com "see file" --attach file_abc --json`,
      `${BIN} send +14155551234 "from my work line" --from +14150000000`,
      `MESSAGES_API_KEY=sk_live_… ${BIN} send user@icloud.com "hi"`,
    ],
  },

  react: {
    blurb: "send a tapback reaction",
    usage: `${BIN} react <message-id> <emoji> [options]`,
    args: [
      { name: "<message-id>", desc: "Message id (msg_…) or imsgGuid. Find one with `messages list`." },
      { name: "<emoji>", desc: "love | like | dislike | laugh | emphasize | question (or a literal emoji)" },
    ],
    options: [
      { flags: "--from <handle>", desc: "Sending line handle (run `lines list`). Defaults to the only active line." },
      { flags: "--to <recipient>", desc: "Recipient handle or chat id (required if not inferable from the message)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} react msg_abc123 love`,
      `${BIN} react msg_abc123 🎉 --to +14155551234`,
      `${BIN} react msg_abc123 like --from +14155551234 --json`,
    ],
  },

  typing: {
    blurb: "send a typing indicator (or list active indicators)",
    usage: `${BIN} typing <to> [options]    # send
       ${BIN} typing list [options]    # list`,
    args: [
      { name: "<to>", desc: "Recipient: phone number (+1…), Apple ID, or chat id" },
    ],
    options: [
      { flags: "--from <handle>", desc: "Sending line handle (run `lines list`). Defaults to the only active line." },
      { flags: "--off", desc: "Stop typing instead of starting" },
      { flags: "--line <handle>", desc: "(list only) Line handle (run `lines list`)" },
      { flags: "--chat <recipient>", desc: "(list only) Chat id or recipient" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} typing +14155551234`,
      `${BIN} typing +14155551234 --off`,
      `${BIN} typing list --line +14155551234 --chat +14150000000`,
    ],
  },

  "typing list": {
    blurb: "list active typing indicators",
    usage: `${BIN} typing list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "Chat id or recipient (required)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} typing list --line +14155551234 --chat +14150000000`,
      `${BIN} typing list --line +14155551234 --chat +14150000000 --json`,
    ],
  },

  read: {
    blurb: "send a read receipt",
    usage: `${BIN} read <to> [options]`,
    args: [
      { name: "<to>", desc: "Recipient: phone number (+1…), Apple ID, or chat id" },
    ],
    options: [
      { flags: "--from <handle>", desc: "Sending line handle (run `lines list`). Defaults to the only active line." },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} read +14155551234`,
      `${BIN} read user@icloud.com --from +14150000000`,
    ],
  },

  lines: {
    blurb: "list your phone lines",
    usage: `${BIN} lines list [options]`,
    options: [
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} lines list`,
      `${BIN} lines list --json`,
    ],
  },

  "lines list": {
    blurb: "list your phone lines",
    usage: `${BIN} lines list [options]`,
    options: [
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} lines list`,
      `${BIN} lines list --json`,
    ],
  },

  chats: {
    blurb: "list chats on a line",
    usage: `${BIN} chats list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--limit <n>", desc: "Max rows (default 50)" },
      { flags: "--cursor <c>", desc: "Pagination cursor from a prior response (look for nextCursor in JSON output)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} chats list --line +14155551234`,
      `${BIN} chats list --line +14155551234 --limit 200 --json`,
    ],
  },

  "chats list": {
    blurb: "list chats on a line",
    usage: `${BIN} chats list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--limit <n>", desc: "Max rows (default 50)" },
      { flags: "--cursor <c>", desc: "Pagination cursor from a prior response (look for nextCursor in JSON output)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} chats list --line +14155551234`,
      `${BIN} chats list --line +14155551234 --limit 200 --json`,
    ],
  },

  messages: {
    blurb: "list or get messages",
    usage: `${BIN} messages list [options]
       ${BIN} messages get <id> [options]`,
    options: [
      { flags: "--line <handle>", desc: "(list/get) Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "(list/get) Chat id or recipient (required, run `chats list --line …`)" },
      { flags: "--limit <n>", desc: "(list) Max rows (default 50)" },
      { flags: "--cursor <c>", desc: "(list) Pagination cursor (look for nextCursor in JSON output)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} messages list --line +14155551234 --chat +14150000000`,
      `${BIN} messages list --line +14155551234 --chat +14150000000 --json --limit 200`,
      `${BIN} messages get msg_abc123 --line +14155551234 --chat +14150000000`,
    ],
  },

  "messages list": {
    blurb: "list messages in a chat",
    usage: `${BIN} messages list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "Chat id or recipient (required, run `chats list --line …`)" },
      { flags: "--limit <n>", desc: "Max rows (default 50)" },
      { flags: "--cursor <c>", desc: "Pagination cursor (look for nextCursor in JSON output)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} messages list --line +14155551234 --chat +14150000000`,
      `${BIN} messages list --line +14155551234 --chat +14150000000 --json --limit 200`,
    ],
  },

  "messages get": {
    blurb: "show a single message",
    usage: `${BIN} messages get <id> [options]`,
    args: [
      { name: "<id>", desc: "Message id (msg_…) or imsgGuid. Find one with `messages list`." },
    ],
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "Chat id or recipient (required, run `chats list --line …`)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} messages get msg_abc123 --line +14155551234 --chat +14150000000`,
      `${BIN} messages get msg_abc123 --line +14155551234 --chat +14150000000 --json`,
    ],
  },

  reactions: {
    blurb: "list reactions on a message",
    usage: `${BIN} reactions list [options]`,
    options: [
      { flags: "--message <id>", desc: "Message id (msg_…) — required. Find one with `messages list`." },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} reactions list --message msg_abc123`,
      `${BIN} reactions list --message msg_abc123 --json`,
    ],
  },

  "reactions list": {
    blurb: "list reactions on a message",
    usage: `${BIN} reactions list [options]`,
    options: [
      { flags: "--message <id>", desc: "Message id (msg_…) — required. Find one with `messages list`." },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} reactions list --message msg_abc123`,
      `${BIN} reactions list --message msg_abc123 --json`,
    ],
  },

  receipts: {
    blurb: "list read receipts",
    usage: `${BIN} receipts list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "Chat id or recipient (required, run `chats list --line …`)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} receipts list --line +14155551234 --chat +14150000000`,
    ],
  },

  "receipts list": {
    blurb: "list read receipts",
    usage: `${BIN} receipts list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--chat <recipient>", desc: "Chat id or recipient (required, run `chats list --line …`)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} receipts list --line +14155551234 --chat +14150000000`,
    ],
  },

  files: {
    blurb: "upload or download files",
    usage: `${BIN} files upload <path> [options]
       ${BIN} files get <id> [options]`,
    options: [
      { flags: "--mime <type>", desc: "(upload) Override MIME type (default: inferred from extension)" },
      { flags: "--filename <name>", desc: "(upload) Override filename" },
      { flags: "--download", desc: "(get) Stream the file to stdout instead of printing the URL" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} files upload ./photo.jpg`,
      `${BIN} files get file_abc123`,
      `${BIN} files get file_abc123 --download > out.jpg`,
    ],
  },

  "files upload": {
    blurb: "upload a file and print its file_… id",
    usage: `${BIN} files upload <path> [options]`,
    args: [
      { name: "<path>", desc: "Local file path. Use `-` to read bytes from stdin." },
    ],
    options: [
      { flags: "--mime <type>", desc: "Override MIME type (default: inferred from extension)" },
      { flags: "--filename <name>", desc: "Override filename (required when reading from stdin)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} files upload ./photo.jpg`,
      `${BIN} files upload ./photo.jpg --json`,
      `cat photo.jpg | ${BIN} files upload - --filename photo.jpg --mime image/jpeg`,
    ],
  },

  "files get": {
    blurb: "print a download URL for a file (or stream with --download)",
    usage: `${BIN} files get <id> [options]`,
    args: [
      { name: "<id>", desc: "File id (file_…) returned from `files upload`" },
    ],
    options: [
      { flags: "--download", desc: "Stream the file bytes to stdout" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} files get file_abc123`,
      `${BIN} files get file_abc123 --download > out.jpg`,
    ],
  },

  outbox: {
    blurb: "inspect outbound items",
    usage: `${BIN} outbox get <id> [options]`,
    examples: [
      `${BIN} outbox get obx_abc123`,
      `${BIN} outbox get obx_abc123 --json`,
    ],
  },

  "outbox get": {
    blurb: "look up an outbox item by id",
    usage: `${BIN} outbox get <id> [options]`,
    args: [
      { name: "<id>", desc: "Outbox id (obx_…). Returned from `send` in JSON mode." },
    ],
    options: [
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} outbox get obx_abc123`,
      `${BIN} outbox get obx_abc123 --json`,
    ],
  },

  webhooks: {
    blurb: "manage webhook subscriptions",
    usage: `${BIN} webhooks list [options]
       ${BIN} webhooks create [options]
       ${BIN} webhooks delete <id>`,
    options: [
      { flags: "--line <handle>", desc: "(list/create) Line handle to scope to (run `lines list`)" },
      { flags: "--url <url>", desc: "(create) Delivery URL" },
      { flags: "--event <name>", desc: "(create) Event name, e.g. message.received. Repeatable." },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} webhooks list --line +14155551234`,
      `${BIN} webhooks create --url https://example.com/hook --event message.received`,
      `${BIN} webhooks delete wh_abc123`,
    ],
  },

  "webhooks list": {
    blurb: "list webhook subscriptions",
    usage: `${BIN} webhooks list [options]`,
    options: [
      { flags: "--line <handle>", desc: "Line handle (required, run `lines list`)" },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} webhooks list --line +14155551234`,
      `${BIN} webhooks list --line +14155551234 --json`,
    ],
  },

  "webhooks create": {
    blurb: "create a webhook subscription",
    usage: `${BIN} webhooks create [options]`,
    options: [
      { flags: "--url <url>", desc: "Delivery URL (required)" },
      { flags: "--event <name>", desc: "Event name, e.g. message.received. Required and repeatable." },
      { flags: "--line <handle>", desc: "Line handle to scope to. Omit for all lines." },
      { flags: "--json", desc: "Emit JSON" },
    ],
    examples: [
      `${BIN} webhooks create --url https://example.com/hook --event message.received`,
      `${BIN} webhooks create --url https://example.com/hook --event message.received --event message.delivered --line +14155551234`,
    ],
  },

  "webhooks delete": {
    blurb: "delete a webhook by id",
    usage: `${BIN} webhooks delete <id>`,
    args: [
      { name: "<id>", desc: "Webhook id (wh_…). Find one with `webhooks list`." },
    ],
    examples: [`${BIN} webhooks delete wh_abc123`],
  },

  listen: {
    blurb: "stream events live; with --forward-to, post signed webhooks to a local URL",
    usage: `${BIN} listen [options]`,
    options: [
      { flags: "-f, --forward-to <url>", desc: "POST events to this URL with X-Webhook-Signature headers" },
      { flags: "--secret <s>", desc: "HMAC secret for --forward-to (defaults to MESSAGES_LISTEN_SECRET or random per-session)" },
      { flags: "--event <name>", desc: "Event name to filter (e.g. message.received). Repeatable. Default: all." },
      { flags: "--line <id>", desc: "Line id (ln_…) to scope subscription to. Repeatable." },
      { flags: "--since <unix-ms>", desc: "Start streaming from this unix-ms timestamp (default: now - 60s)" },
      { flags: "--json", desc: "Always emit JSON, no human prefix" },
    ],
    examples: [
      `${BIN} listen`,
      `${BIN} listen --event message.received`,
      `${BIN} listen --forward-to http://localhost:3000/webhook`,
      `MESSAGES_LISTEN_SECRET=… ${BIN} listen --forward-to http://localhost:3000/webhook`,
    ],
  },
};

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function renderTwoCol(rows: { left: string; right: string }[], indent = "  "): string {
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.left.length));
  const colWidth = Math.max(width, 24);
  return rows.map((r) => `${indent}${pad(r.left, colWidth)} ${r.right}`).join("\n");
}

function renderBlock(block: Block): string {
  const lines: string[] = [];
  lines.push(`${block.title}:`);
  for (const line of block.lines) {
    lines.push(line === "" ? "" : `  ${line}`);
  }
  return lines.join("\n");
}

export function renderRootHelp(): string {
  const lines: string[] = [];
  lines.push(ROOT.blurb);
  lines.push("");
  lines.push(`Usage: ${ROOT.usage}`);
  lines.push("");

  for (const section of ROOT.sections) {
    const header = section.usagePrefix
      ? `${section.title}:  ${section.usagePrefix}`
      : `${section.title}:`;
    lines.push(header);
    lines.push(
      renderTwoCol(section.items.map((i) => ({ left: i.name, right: i.desc }))),
    );
    lines.push("");
  }

  lines.push("Options:");
  lines.push(renderTwoCol(ROOT.options.map((o) => ({ left: o.flags, right: o.desc }))));

  for (const block of ROOT.blocks) {
    lines.push("");
    lines.push(renderBlock(block));
  }

  lines.push("");
  lines.push(`Run \`${BIN} <command> --help\` for details on a command.`);
  return lines.join("\n");
}

export function renderCommandHelp(path: string[]): string | null {
  // Try the longest path first (e.g. "files upload"), then fall back to root cmd.
  for (let n = path.length; n > 0; n--) {
    const key = path.slice(0, n).join(" ");
    const spec = COMMANDS[key];
    if (spec) return formatCommand(key, spec);
  }
  return null;
}

function formatCommand(name: string, spec: CommandSpec): string {
  const lines: string[] = [];
  lines.push(`${BIN} ${name} - ${spec.blurb}`);
  lines.push("");
  lines.push(`Usage: ${spec.usage}`);

  if (spec.args && spec.args.length) {
    lines.push("");
    lines.push("Arguments:");
    lines.push(renderTwoCol(spec.args.map((a) => ({ left: a.name, right: a.desc }))));
  }

  if (spec.options && spec.options.length) {
    lines.push("");
    lines.push("Options:");
    lines.push(renderTwoCol(spec.options.map((o) => ({ left: o.flags, right: o.desc }))));
  }

  if (spec.examples && spec.examples.length) {
    lines.push("");
    lines.push("Examples:");
    for (const ex of spec.examples) {
      lines.push(`  ${ex}`);
    }
  }

  return lines.join("\n");
}

export function renderVersion(): string {
  return `${BIN} ${VERSION}`;
}

// Parent commands whose only meaningful invocation is a subcommand. When the
// user runs the bare parent (e.g. `messages-dev lines`), we print our help
// instead of letting citty's auto-help fire. `typing` is intentionally absent
// because it's both a verb (`typing <to>`) and a noun (`typing list`).
const PARENT_SUBCOMMANDS: Record<string, Set<string>> = {
  lines: new Set(["list", "ls"]),
  chats: new Set(["list", "ls"]),
  messages: new Set(["list", "ls", "get"]),
  reactions: new Set(["list", "ls"]),
  receipts: new Set(["list", "ls"]),
  files: new Set(["upload", "get"]),
  outbox: new Set(["get"]),
  webhooks: new Set(["list", "ls", "create", "delete"]),
};

/**
 * Top-level argv handler. Returns true when help/version was rendered (caller
 * should exit). Stripping --help here means citty never sees it and its
 * built-in auto-help never fires.
 */
export function handleHelpAndVersion(argv: string[]): boolean {
  if (argv.length === 0) {
    process.stdout.write(renderRootHelp() + "\n");
    return true;
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(renderVersion() + "\n");
    return true;
  }

  const helpIdx = argv.findIndex((a) => a === "--help" || a === "-h");

  // Walk leading non-flag tokens to determine the command path.
  const path: string[] = [];
  for (const tok of argv) {
    if (tok.startsWith("-")) break;
    path.push(tok);
  }

  if (helpIdx !== -1) {
    if (path.length === 0) {
      process.stdout.write(renderRootHelp() + "\n");
      return true;
    }
    const out = renderCommandHelp(path);
    if (out) {
      process.stdout.write(out + "\n");
      return true;
    }
    // Unknown command path: fall back to root help on stderr with a hint.
    process.stderr.write(`Unknown command: ${path.join(" ")}\n\n`);
    process.stderr.write(renderRootHelp() + "\n");
    return true;
  }

  // Flag-only invocation with no command (e.g. `messages-dev --json`). Treat
  // as a request for root help — same as bare `messages-dev`. Avoids the
  // dispatcher producing a misleading "Unknown command" exit.
  if (path.length === 0) {
    process.stdout.write(renderRootHelp() + "\n");
    return true;
  }

  // No --help present. Catch parent-without-subcommand: e.g. `messages-dev
  // lines` or `messages-dev webhooks --json`. Citty would otherwise dump its
  // auto-help here.
  const first = path[0];
  if (first && PARENT_SUBCOMMANDS[first]) {
    const second = path[1];
    if (!second || !PARENT_SUBCOMMANDS[first]!.has(second)) {
      const out = renderCommandHelp([first]);
      if (out) {
        process.stderr.write(out + "\n");
        return true;
      }
    }
  }

  return false;
}
