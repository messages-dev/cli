import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit, success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";
import { dim, yellow } from "../style";

const list = defineCommand({
  meta: { name: "list", description: "List webhook subscriptions." },
  args: {
    line: {
      type: "string",
      description: "Line handle (required)",
      required: true,
      hint: "Run `messages-dev lines list` to see options.",
    },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const res = await client.listWebhooks({ from: args.line as string });
      emit(
        json
          ? res
          : res.data.map((w) => ({
              id: w.id,
              url: w.url,
              events: w.events.join(","),
              active: w.isActive,
            })),
        json,
      );
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const create = defineCommand({
  meta: { name: "create", description: "Create a webhook subscription." },
  args: {
    url: {
      type: "string",
      description: "Webhook delivery URL",
      required: true,
      hint: "Pass --url <https-url>.",
    },
    event: {
      type: "string",
      description: "Event name (e.g. message.received). Repeatable.",
      required: true,
      hint: "Pass at least one --event <name>, e.g. --event message.received.",
    },
    line: { type: "string", description: "Line handle to scope to (omit for all)" },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    const { client } = await getAuthedClient(args);
    try {
      const events = (Array.isArray(args.event) ? args.event : [args.event]) as string[];
      const res = await client.createWebhook({
        url: args.url as string,
        events,
        from: (args.line as string | undefined) ?? "",
      });
      success(`Created webhook ${res.id}`, res, json);
      if (!json) {
        console.log(
          `\n${yellow("⚠")}  ${dim("The")} secret ${dim("above is shown once — store it now to verify webhook signatures.")}`,
        );
      }
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const del = defineCommand({
  meta: { name: "delete", description: "Delete a webhook by ID." },
  args: {
    id: { type: "positional", description: "Webhook ID (wh_…)", required: false },
    json: { type: "boolean" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.id) {
      fail("usage", "Usage: messages-dev webhooks delete <id>", { json });
    }
    const { client } = await getAuthedClient(args);
    try {
      await client.deleteWebhook({ id: args.id as string });
      success(`Deleted webhook ${args.id}`, { deleted: args.id }, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "webhooks", description: "Manage webhook subscriptions." },
  subCommands: { list, ls: list, create, delete: del },
});
