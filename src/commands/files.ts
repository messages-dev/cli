import { defineCommand } from "../cli";
import { getAuthedClient } from "../client";
import { emit, success } from "../output";
import { fail, jsonMode, toMessage } from "../errors";

const upload = defineCommand({
  meta: { name: "upload", description: "Upload a file and print its file_… id." },
  args: {
    path: { type: "positional", description: "Local path to the file (use - for stdin)", required: false },
    mime: { type: "string", description: "Override MIME type (default: inferred from extension)" },
    filename: { type: "string", description: "Override filename" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.path) {
      fail("usage", "Usage: messages-dev files upload <path> [options]", { json });
    }
    const { client } = await getAuthedClient(args);
    try {
      const path = args.path as string;
      let bytes: ArrayBuffer;
      let inferredName: string;
      let inferredType: string;
      if (path === "-") {
        const buf = Buffer.from(await Bun.stdin.text());
        bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        inferredName = "stdin";
        inferredType = "application/octet-stream";
      } else {
        const file = Bun.file(path);
        if (!(await file.exists())) {
          fail("not_found", `File not found: ${path}`, { json });
        }
        bytes = await file.arrayBuffer();
        inferredName = path.split("/").pop() ?? "file";
        inferredType = file.type || "application/octet-stream";
      }
      const mimeType = (args.mime as string | undefined) ?? inferredType;
      const filename = (args.filename as string | undefined) ?? inferredName;
      const result = await client.uploadFile({
        file: new Blob([bytes], { type: mimeType }),
        filename,
        mimeType,
      });
      success(`Uploaded ${filename}`, result, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

const get = defineCommand({
  meta: { name: "get", description: "Print a download URL (or stream with --download)." },
  args: {
    id: { type: "positional", description: "File id (file_…)", required: false },
    download: { type: "boolean", description: "Stream the file bytes to stdout" },
    json: { type: "boolean", description: "Emit JSON" },
  },
  async run({ args }) {
    const json = jsonMode(args);
    if (!args.id) {
      fail("usage", "Usage: messages-dev files get <id> [options]", { json });
    }
    const { client } = await getAuthedClient(args);
    try {
      const { url } = await client.getFileUrl({ id: args.id as string });
      if (args.download) {
        const res = await fetch(url);
        if (!res.ok) {
          fail("generic", `Download failed: ${res.status} ${res.statusText}`, { json });
        }
        const reader = res.body?.getReader();
        if (!reader) {
          fail("generic", "No response body to stream.", { json });
        }
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          process.stdout.write(value);
        }
        return;
      }
      emit({ url }, json);
    } catch (err) {
      fail("generic", toMessage(err), { json });
    }
  },
});

export default defineCommand({
  meta: { name: "files", description: "Upload or download files." },
  subCommands: { upload, get },
});
