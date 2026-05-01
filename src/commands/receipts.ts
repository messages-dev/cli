import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const list = defineCommand({
  meta: { name: "list", description: "List read receipts." },
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
      const res = await client.listReadReceipts({
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
  meta: { name: "receipts", description: "List read receipts." },
  subCommands: { list, ls: list },
});
