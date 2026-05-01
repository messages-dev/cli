import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

export default defineCommand({
  meta: {
    name: "send",
    description: "Send a text, media, or audio message.",
  },
  args: {
    to: { type: "positional", description: "Recipient phone number or Apple ID", required: false },
    text: { type: "positional", description: "Message text (also accepted on stdin)", required: false },
    from: {
      type: "string",
      description: "Sending line handle (defaults to the only active line if you have one).",
    },
    attach: { type: "string", description: "File ID (file_…) to attach (repeatable)" },
    "reply-to": { type: "string", description: "Reply to message ID (msg_…) or imsgGuid" },
    audio: { type: "string", description: "Send a voice memo from a local audio file" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.to) {
      fail("usage", "Usage: messages-dev send <to> [text] [options]", { json });
    }
    const { client } = await getAuthedClient(args);

    let from = args.from as string | undefined;
    if (!from) {
      const list = await client.listLines();
      const active = list.data.filter((l) => l.isActive);
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

    // Read stdin when text was not given as an arg and we're piped to.
    let text = args.text as string | undefined;
    if (text === undefined && !process.stdin.isTTY && !args.audio) {
      text = (await Bun.stdin.text()).replace(/\n+$/, "");
      if (text === "") text = undefined;
    }

    const replyTo = (args["reply-to"] as string | undefined) ?? (args.replyTo as string | undefined);
    const attachments = args.attach
      ? (Array.isArray(args.attach) ? (args.attach as string[]) : [args.attach as string])
      : undefined;

    try {
      if (args.audio) {
        const path = args.audio as string;
        const file = Bun.file(path);
        if (!(await file.exists())) {
          fail("not_found", `Audio file not found: ${path}`, { json });
        }
        const uploaded = await client.uploadFile({
          file: new Blob([await file.arrayBuffer()], { type: file.type || "audio/m4a" }),
          filename: path.split("/").pop() ?? "audio.m4a",
          mimeType: file.type || "audio/m4a",
        });
        const result = await client.sendAudioMessage({
          from,
          to: args.to as string,
          audioMessage: uploaded.id,
          ...(replyTo ? { replyTo } : {}),
        });
        success(`Queued audio to ${args.to} via ${from}`, result, json);
        return;
      }

      const result = await client.sendMessage({
        from,
        to: args.to as string,
        ...(text !== undefined ? { text } : {}),
        ...(attachments ? { attachments } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      success(`Queued to ${args.to} via ${from}`, result, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});
