import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List chats on a line." },
  args: {
    line: {
      type: "string",
      description: "Line handle (required)",
      required: true,
      hint: "Run `messages-dev lines list` to see options.",
    },
    limit: { type: "string", description: "Max rows (default 50)" },
    cursor: { type: "string", description: "Pagination cursor from a prior response" },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listChats({
        from: args.line as string,
        ...(args.limit ? { limit: parseInt(args.limit as string, 10) } : {}),
        ...(args.cursor ? { cursor: args.cursor as string } : {}),
      });
      emit(
        json
          ? res
          : res.data.map((c) => ({
              id: c.id,
              identifier: c.identifier,
              name: c.name ?? "—",
              group: Boolean(c.isGroup),
              last_at: c.lastMessageAt ?? null,
            })),
        json,
      );
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "chats", description: "List chats on a line." },
  subCommands: { list, ls: list },
});
