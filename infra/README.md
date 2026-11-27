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

## Image uploads

Images uploaded in the admin (blog covers, social images) go to an S3-compatible bucket when
`S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are set. The bucket (or `S3_PUBLIC_URL`, e.g. a
CDN or R2 custom domain) must be publicly readable, because pages link to the files directly. For
Cloudflare R2 set `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com` and leave `S3_REGION=auto`;
for MinIO also set `S3_FORCE_PATH_STYLE=true`.

Without S3, or when an S3 upload fails, the API saves the file in the `uploads` volume and serves it at
`API_PUBLIC_URL/v1/uploads/...`. That volume is not in the nightly Postgres backup, so use S3 in
production or back the volume up separately. Caddy allows 10 MB bodies for uploads only; the API's own
limit is `UPLOAD_MAX_MB` (8).

## Backups

The `backup` service dumps Postgres every night at `BACKUP_HOUR_UTC`:30 UTC (default 21:30, which is
03:00 IST), and once when it starts. Each run:

1. Dumps the database with `pg_dump` (custom format).
2. Restores that dump into a scratch database and checks the tables and migrations, so a broken dump
   is caught the same night.
3. Encrypts it with [age](https://age-encryption.org) to `BACKUP_AGE_RECIPIENT`. That is a public
   key, so the server cannot read old backups. Keep the private key offline (a password manager and
   one printed copy).
4. Uploads it to the S3-compatible bucket (Cloudflare R2 or Backblaze B2) set by the `RCLONE_CONFIG_S3_*`
   settings and `BACKUP_S3_BUCKET`, checks the size, and deletes copies older than
   `BACKUP_RETENTION_DAYS` (30).

The container is unhealthy if there has been no successful backup for 30 hours. Production refuses to
start the service without its settings.

First-time setup:

```bash
docker run --rm --entrypoint age-keygen vela-backup:local > vela-backup-key.txt
```

Put the `age1…` public key from that file in `BACKUP_AGE_RECIPIENT`, move the file off the server, then
fill in the bucket settings in `env/<environment>.env`.

Useful commands on the server (`APP_ENV`, `IMAGE_TAG` and `POSTGRES_PASSWORD` exported as for a deploy):

```bash
docker compose -f compose.yml run --rm backup once
docker compose -f compose.yml run --rm backup list
docker compose -f compose.yml run --rm -v /path/to/key-dir:/keys:ro backup restore <file name> /keys/vela-backup-key.txt [database url]
```

Restore into a new database first and check it before pointing the app at it. Test a restore from the
bucket with the real key every three months.
