# Self-host Langfuse (local evaluation)

A curated [Langfuse v3](https://langfuse.com) Docker Compose stack for running
this certification pipeline against a self-hosted Langfuse instance instead of
[Langfuse Cloud](https://cloud.langfuse.com).

This is meant for local evaluation and demos — not production. For a hardened
production deployment (Kubernetes, managed databases, external object storage,
TLS, SSO), follow the [official self-hosting guide](https://langfuse.com/self-hosting).

## Prerequisites

- Docker 24+ and Docker Compose v2
- ~4 GB free RAM (ClickHouse + Postgres + the two Langfuse containers)
- Free ports on the host: `3000` (Langfuse UI), `3030` (worker), `5432`
  (Postgres), `6379` (Redis), `8123` / `9000` (ClickHouse), `9090` / `9091`
  (MinIO API / console)

## Start the stack

From the repo root:

```bash
cd selfhost
docker compose -f docker-compose.langfuse.yml up -d
```

First boot takes a couple of minutes (ClickHouse migrations run on the worker).
Watch progress with:

```bash
docker compose -f docker-compose.langfuse.yml logs -f langfuse-web langfuse-worker
```

## Create a project and get API keys

1. Open <http://localhost:3000>.
2. Sign up (the first account becomes the org owner).
3. Create an **Organization**, then a **Project**.
4. **Settings → API Keys → Create new API keys**. Copy the public + secret keys.
5. Populate the project `.env` (one level up):

   ```bash
   # ../.env
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_BASE_URL=http://localhost:3000
   ```

Then jump back to the main [README Quick Start](../README.md#quick-start) and
continue from step 2 (Load Sample Dataset).

## Stop / reset

```bash
# Stop containers but keep data
docker compose -f docker-compose.langfuse.yml down

# Stop and wipe all data (Postgres, ClickHouse, MinIO, Redis volumes)
docker compose -f docker-compose.langfuse.yml down -v
```

## Security notes

The compose file ships with placeholder credentials marked `# CHANGEME`
(Postgres password, ClickHouse password, Redis auth, MinIO secret, NextAuth
secret, encryption key, salt). They are fine for a laptop demo but **must** be
replaced before exposing the stack to anything beyond localhost.

To generate the cryptographic values:

```bash
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -base64 32 # NEXTAUTH_SECRET, SALT
```

Override them by exporting the corresponding env vars before `docker compose
up`, or by writing a `selfhost/.env` file (Docker Compose loads it
automatically).

## Where this file came from

`docker-compose.langfuse.yml` is a copy of Langfuse's official v3 compose
([langfuse/langfuse#docker-compose.yml](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml))
shipped here so the certification pipeline has a known-good local stack. When
Langfuse publishes a new major version, re-sync from the upstream file.
