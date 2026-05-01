import { createServer } from "node:http";
import { hostname } from "node:os";
import { spawn } from "node:child_process";
import { API_URL, CLERK_FRONTEND_API, CLERK_OAUTH_CLIENT_ID, USER_AGENT } from "../api";
import { pkcePair, randomBase64Url } from "./pkce";
import { saveProfile } from "./creds";
import { select } from "./select";

type Org = { id: string; name: string | null; slug: string | null; role: string | null };

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>messages CLI</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:6rem auto;padding:0 1rem;color:#111}h1{font-size:1.25rem}</style>
</head><body><h1>You're signed in.</h1><p>Return to your terminal — the CLI has your credentials.</p></body></html>`;

const ERROR_HTML = (msg: string) => `<!doctype html><html><head><meta charset="utf-8"><title>messages CLI</title></head>
<body><h1>Login failed</h1><pre>${msg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c))}</pre></body></html>`;

export type LoginResult = {
  apiKey: string;
  prefix: string;
  email: string | null;
  orgId: string;
};

export type LoginOptions = {
  /** If set, skip the interactive picker and use this org directly. */
  orgId?: string;
};

function openBrowser(url: string): boolean {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
    child.unref();
    child.on("error", () => {});
    return true;
  } catch {
    return false;
  }
}

export async function runLogin(opts: LoginOptions = {}): Promise<LoginResult> {
  if (!CLERK_OAUTH_CLIENT_ID) {
    throw new Error(
      "MESSAGES_CLERK_OAUTH_CLIENT_ID is not set. Configure the CLI build with the Clerk OAuth Application's client_id, or set the env var for local dev.",
    );
  }

  const { verifier, challenge } = await pkcePair();
  const state = randomBase64Url(24);

  // Fixed port matches the URI registered on the Clerk OAuth Application.
  // Clerk requires exact redirect URI matches (no wildcards), so we can't
  // use an ephemeral port here.
  const port = 33333;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authorizeUrl = new URL(`${CLERK_FRONTEND_API.replace(/\/$/, "")}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", CLERK_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile email");

  const authCode = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
        if (url.pathname !== "/callback") {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        const error = url.searchParams.get("error");
        if (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(ERROR_HTML(error));
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        if (returnedState !== state || !code) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(ERROR_HTML("state mismatch or missing code"));
          server.close();
          reject(new Error("OAuth state mismatch — possible CSRF attempt."));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(SUCCESS_HTML);
        server.close();
        resolve(code);
      } catch (err) {
        res.statusCode = 500;
        res.end("internal error");
        server.close();
        reject(err);
      }
    });

    server.once("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is in use. Close whatever is bound to it, or run another login session — the CLI uses a fixed callback port to match the Clerk OAuth App.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`Opening your browser to authorize…`);
      console.log(`If it doesn't open, visit:\n  ${authorizeUrl}\n`);
      const opened = openBrowser(authorizeUrl.toString());
      if (!opened) {
        console.log("(Could not auto-open a browser — open the URL above manually.)");
      }
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out after 5 minutes."));
    }, 5 * 60_000).unref();
  });

  // Exchange auth code for Clerk access token.
  const tokenRes = await fetch(`${CLERK_FRONTEND_API.replace(/\/$/, "")}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: redirectUri,
      client_id: CLERK_OAUTH_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    throw new Error(`Failed to exchange auth code (${tokenRes.status}): ${text || tokenRes.statusText}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Clerk token response did not include access_token.");
  }
  const accessToken = tokenJson.access_token;

  // Resolve which org this key belongs to.
  let orgId = opts.orgId;
  if (!orgId) {
    const orgs = await fetchOrgs(accessToken);
    if (orgs.length === 0) {
      throw new Error(
        "Your Clerk account has no organization memberships. Create or join one in app.messages.dev first.",
      );
    }
    if (orgs.length === 1) {
      orgId = orgs[0]!.id;
    } else {
      orgId = await select(
        `You belong to ${orgs.length} organizations — pick one for this CLI session:`,
        orgs.map((o) => ({
          label: o.name ?? o.slug ?? o.id,
          hint: [o.slug && o.slug !== o.name ? o.slug : null, o.role].filter(Boolean).join(" · "),
          value: o.id,
        })),
      );
    }
  }

  // Hand the Clerk access token to our backend; receive an sk_live_*.
  const exchangeRes = await fetch(`${API_URL.replace(/\/$/, "")}/api/v1/cli/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ name: `messages CLI on ${hostname()}`, org_id: orgId }),
  });
  if (!exchangeRes.ok) {
    const text = await exchangeRes.text().catch(() => "");
    throw new Error(`Exchange failed (${exchangeRes.status}): ${text || exchangeRes.statusText}`);
  }
  const exchange = (await exchangeRes.json()) as {
    api_key: string;
    key_prefix: string;
    org_id: string;
    email: string | null;
  };

  const profile = {
    apiKey: exchange.api_key,
    prefix: exchange.key_prefix,
    email: exchange.email,
    orgId: exchange.org_id,
    createdAt: Date.now(),
  };
  await saveProfile("default", profile);

  return {
    apiKey: exchange.api_key,
    prefix: exchange.key_prefix,
    email: exchange.email,
    orgId: exchange.org_id,
  };
}

async function fetchOrgs(accessToken: string): Promise<Org[]> {
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/v1/cli/orgs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
    body: "{}",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to list organizations (${res.status}): ${text || res.statusText}`);
  }
  const body = (await res.json()) as { orgs: Org[] };
  return body.orgs ?? [];
}
