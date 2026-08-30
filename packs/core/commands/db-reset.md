---
description: Tear down the local Postgres container and rebuild it from migrations and seed data
---
Rebuild the local database from scratch. This destroys all local data in the
project's Postgres volume - confirm with the user before running it if there is
any chance they have data they care about.

```bash
docker compose down -v
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

Then confirm the database is actually serving, rather than assuming:

```bash
curl -fsS localhost:3000/api/health
```

If `docker compose up -d` returns before Postgres is ready, the healthcheck in
`docker-compose.yml` is doing its job - wait for `docker compose ps` to report
`healthy` before running migrations.
