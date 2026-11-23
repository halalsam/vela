# Server infrastructure

One VPS runs a shared Caddy (`compose.edge.yml`) and two copies of the app stack (`compose.yml`):
`vela-staging` and `vela-production`, each with its own Postgres.

## First-time setup on the VPS

```bash
sudo mkdir -p /srv/vela && sudo chown "$USER" /srv/vela
docker network create edge
```

Copy `infra/` to `/srv/vela/infra`, then for each environment create two files next to the
example (never commit them):

- `env/staging.env` and `env/production.env`: app settings, see `env/example.env`.
  Generate `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` with `openssl rand -hex 32`. Set
  `API_PUBLIC_URL` to the environment's API URL and `COOKIE_DOMAIN` to the shared parent domain
  so the website's session cookie reaches the API. Production refuses to start without live SMS
  keys (MSG91 and Twilio).
- `env/staging.secrets` and `env/production.secrets`: `POSTGRES_PASSWORD=...`

Start Caddy once (DNS for both API domains must point at the VPS):

```bash
API_DOMAIN=api.example.com STAGING_API_DOMAIN=staging-api.example.com ACME_EMAIL=ops@example.com \
  docker compose -f compose.edge.yml up -d
```

## Deploys

CI builds `ghcr.io/halalsam/vela-server:<sha>` on every push to `main` and runs
`infra/deploy.sh staging <sha>` over SSH. Production deploys run the same script from the
"Deploy server" workflow with a chosen tag, behind the `production` environment approval.

Manual deploy or rollback: `./deploy.sh production <older-sha>`. Migrations must stay compatible
with the previous release so a rollback never needs a down migration.
