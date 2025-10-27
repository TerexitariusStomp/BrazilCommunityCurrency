Production Readiness Notes

- Environment & secrets
  - Copy `.env.example` to `.env` and set all required values.
  - Never commit real secrets. If any were committed previously, revoke and rotate immediately.
  - Use `CORS_ORIGIN` to restrict allowed browser origins.
  - Set `ENABLE_ONCHAIN_DEPLOY=true` only when `FACTORY_ADDRESS`, `RPC_ENDPOINT`, and `PRIVATE_KEY` are configured.

- Server hardening
  - JSON body size limited via `BODY_LIMIT` (default 100kb).
  - Basic input validation on REST endpoints.
  - Add a reverse proxy (NGINX/Caddy) for TLS termination and request buffering.

- Twilio WhatsApp
  - Env vars (generic names preferred): `ACCOUNT_SID`, `AUTH_TOKEN`, `PHONE_NUMBER`
  - Legacy names still supported: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - WhatsApp UX keeps users in-chat. For self-custodial users, do a one-time approval of the operator:
    - Link sent to `approve-operator.html?token=...&operator=...` (in-app browser).
    - After approval, sends can be initiated in chat and executed on-chain by the operator via `transferFrom`.
    - No private keys are stored; operator key is env-only, users control their wallets.

- Server-initiated transfers (optional)
  - To enable WhatsApp-initiated transfers without storing any private keys, set `PRIVATE_KEY` via environment only.
  - Users must approve allowance to the operator (server) before `transferFrom` can succeed.
  - No private keys are ever stored in the database; only the in-memory signer from `PRIVATE_KEY` is used at runtime.

- Blockchain deployment
  - Default token deployer runs in safe mock mode unless `ENABLE_ONCHAIN_DEPLOY=true` and env is complete.
  - Real on-chain deploy uses `artifacts/contracts/TokenFactory.sol/TokenFactory.json` at `FACTORY_ADDRESS`.
  - Authorize oracle updater by setting `ORACLE_UPDATER_ADDRESS` before running `scripts/deploy.js`.

- Pluggy integration
  - Webhook endpoint: `POST /api/webhooks/pluggy`.
  - Set `BASE_URL` so Pluggy redirects correctly.

- Vercel setup
  - Do not commit secrets. Use Vercel Project Environment Variables instead of `vercel.json`.
  - Required vars for Pluggy backend usage:
    - `PLUGGY_CLIENT_ID`
    - `PLUGGY_CLIENT_SECRET`
  - Recommended via CLI (replace scopes as needed):
    - `vercel env add PLUGGY_CLIENT_ID production`
    - `vercel env add PLUGGY_CLIENT_SECRET production`
    - Repeat for `preview` and `development` if applicable.
  - Alternatively in Vercel Dashboard: Project → Settings → Environment Variables.
  - Note: This app’s Express server (`server.js`) reads envs at runtime. If deploying on Vercel, run it as a server (Serverless/Edge Functions) or deploy the API separately; the current `vercel.json` is configured for static build of `public/` only.

- Data services
  - Postgres via `DATABASE_URL` stores only non-sensitive data (sessions, auth tokens, public wallet addresses, token metadata). No private keys are stored.
  - Any signing keys (e.g., `PRIVATE_KEY`, `ORACLE_UPDATE_KEY`) must be provided via environment variables and are never persisted to the database.

- Docker
  - `docker compose up --build` starts API + Postgres.
  - API listens on port `3001`.

- CI
  - GitHub Actions workflow runs install, compile, and tests on PRs.
