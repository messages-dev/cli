// Endpoints baked into the CLI build. Override with env vars for local dev.

// HTTP REST surface. The custom api.messages.dev domain isn't fully wired up
// (TLS handshake fails), so we point straight at the Convex .site URL until
// it is.
export const API_URL =
  process.env.MESSAGES_API_URL ?? "https://cautious-finch-820.eu-west-1.convex.site";
// Convex deployment hostname — used by `listen` for live WebSocket
// subscriptions. Same deployment as API_URL but the `.cloud` variant.
export const CONVEX_URL =
  process.env.MESSAGES_CONVEX_URL ?? "https://cautious-finch-820.eu-west-1.convex.cloud";

// Clerk OAuth Application configured in the Clerk Dashboard. Public client
// (PKCE), no secret. Frontend API is the same Clerk instance the dashboard
// app uses; the CLI hits its hosted /oauth/authorize, /oauth/token endpoints.
export const CLERK_FRONTEND_API =
  process.env.MESSAGES_CLERK_FRONTEND_API ?? "https://clerk.messages.dev";
export const CLERK_OAUTH_CLIENT_ID =
  process.env.MESSAGES_CLERK_OAUTH_CLIENT_ID ?? "";

import { BIN, VERSION } from "./meta";

export const USER_AGENT = `${BIN}/${VERSION} (${process.platform}; ${process.arch})`;
