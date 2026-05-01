import { createClient, type MessagesClient } from "@messages-dev/sdk";
import { API_URL } from "./api";
import { resolveCreds } from "./auth/creds";
import { BIN } from "./meta";
import { fail, jsonMode } from "./errors";

export type Authed = {
  client: MessagesClient;
  apiKey: string;
  source: "env" | "config";
};

export async function getAuthedClient(args: { json?: unknown } = {}): Promise<Authed> {
  const creds = await resolveCreds();
  if (!creds) {
    fail(
      "not_authenticated",
      `Not signed in. Run \`${BIN} login\`, or set MESSAGES_API_KEY for headless use.`,
      { json: jsonMode(args) },
    );
  }
  const client = createClient({ apiKey: creds.apiKey, baseUrl: API_URL });
  return { client, apiKey: creds.apiKey, source: creds.source };
}
