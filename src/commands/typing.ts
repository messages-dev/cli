import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit, success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List active typing indicators." },
  args: {
    line: {
      type: "string",
      description: "Line handle (required)",
      required: true,
      hint: "Run `messages-dev lines list` to see options.",
    },
    chat: {
      type: "string",
      description: "Chat id or recipient (required)",
      required: true,
      hint: "Run `messages-dev chats list --line <handle>` to see options.",
    },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listTypingIndicators({
        from: args.line as string,
        to: args.chat as string,
      });
      emit(json ? res : res.data, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: {
    name: "typing",
    description: "Send a typing indicator (or list active indicators).",
  },
  args: {
    to: { type: "positional", description: "Recipient phone, Apple ID, or chat id", required: false },
    from: { type: "string", description: "Sending line handle (defaults to the only active line)" },
    off: { type: "boolean", description: "Stop typing instead of starting" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  subCommands: { list },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.to) {
      fail("usage", "Missing recipient. Usage: typing <to> [--from <handle>] [--off]", { json });
    }
    const { client } = await getAuthedClient(args);

    let from = args.from as string | undefined;
    if (!from) {
      const linesRes = await client.listLines();
      const active = linesRes.data.filter((l) => l.isActive);
      if (active.length === 0) {
        fail(
          "validation",
          "No active lines found. Pass --from <handle>. Run `messages-dev lines list` to see your lines.",
          { json },
        );
      }
      if (active.length > 1) {
        const handles = active.map((l) => l.handle);
        const example = handles[0]!;
        fail(
          "validation",
          `Multiple active lines (${handles.join(", ")}). Pick one with --from <handle> (e.g. --from ${example}).`,
          { json, details: { active_lines: handles } },
        );
      }
      from = active[0]!.handle;
    }

    try {
      const result = args.off
        ? await client.stopTyping({ from, to: args.to as string })
        : await client.startTyping({ from, to: args.to as string });
      const verb = args.off ? "Stopped typing to" : "Typing to";
      success(`${verb} ${args.to} via ${from}`, result, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
