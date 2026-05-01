import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List messages in a chat." },
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
    limit: { type: "string", description: "Max rows (default 50)" },
    cursor: { type: "string", description: "Pagination cursor from a prior response" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listMessages({
        from: args.line as string,
        to: args.chat as string,
        ...(args.limit ? { limit: parseInt(args.limit as string, 10) } : {}),
        ...(args.cursor ? { cursor: args.cursor as string } : {}),
      });
      emit(
        json
          ? res
          : res.data.map((m) => ({
              id: m.id,
              sent_at: m.sentAt,
              from_me: m.isFromMe,
              sender: m.sender,
              text: (m.text ?? "").slice(0, 80),
            })),
        json,
      );
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const get = defineCommand({
  meta: { name: "get", description: "Show a single message." },
  args: {
    id: { type: "positional", description: "Message ID (msg_…) or imsgGuid", required: false },
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
    if (!args.id) {
      fail("usage", "Usage: messages-dev messages get <id> --line <handle> --chat <recipient>", { json });
    }
    const { client } = await getAuthedClient(args);
    try {
      // The HTTP API exposes a list endpoint, not a singular get. We page
      // forward looking for a matching id; in practice the message is in the
      // first page. Bail after a few pages so this can't pathologically scan.
      const target = args.id as string;
      let page = await client.listMessages({
        from: args.line as string,
        to: args.chat as string,
        limit: 100,
      });
      for (let i = 0; i < 10; i++) {
        const found = page.data.find((m) => m.id === target || m.guid === target);
        if (found) {
          emit(found, json);
          return;
        }
        if (!page.hasMore || !page.nextCursor) break;
        page = await client.listMessages({
          from: args.line as string,
          to: args.chat as string,
          limit: 100,
          cursor: page.nextCursor,
        });
      }
      fail("not_found", `Message ${target} not found in this chat.`, { json });
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "messages", description: "List or get messages." },
  subCommands: { list, ls: list, get },
});
