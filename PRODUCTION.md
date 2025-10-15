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

- Blockchain deployment
  - Default token deployer runs in safe mock mode unless `ENABLE_ONCHAIN_DEPLOY=true` and env is complete.
  - Real on-chain deploy uses `artifacts/contracts/TokenFactory.sol/TokenFactory.json` at `FACTORY_ADDRESS`.
  - Authorize oracle updater by setting `ORACLE_UPDATER_ADDRESS` before running `scripts/deploy.js`.

- Pluggy integration
  - Webhook endpoint: `POST /api/webhooks/pluggy`.
  - Set `BASE_URL` so Pluggy redirects correctly.

- Data services
  - Postgres via `DATABASE_URL` (WhatsApp sessions/auth + wallets/users).

- Docker
  - `docker compose up --build` starts API + Postgres.
  - API listens on port `3001`.

- CI
  - GitHub Actions workflow runs install, compile, and tests on PRs.
