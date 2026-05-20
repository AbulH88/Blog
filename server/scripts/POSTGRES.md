# Postgres on aaPanel — setup + Sequelize migration notes

Step-by-step for switching from SQLite (dev) to Postgres (prod) on your
aaPanel VPS.

---

## 1. Install Postgres via aaPanel

`aaPanel → App Store → search "PostgreSQL" → Install (recommend v16)`

aaPanel handles:
- `pg_hba.conf` (peer + md5 for local connections)
- `postgresql.conf` (listen_addresses='localhost' — good, no remote access)
- systemd service + autostart on reboot
- Firewall (port 5432 blocked from external — only local)

## 2. Create the database + user

`aaPanel → Database → PG Manager → Add Database`

| Field | Value |
|---|---|
| Database name | `cristina_prod` |
| Username | `cristina_app` |
| Password | Click 🎲 to auto-generate (copy this somewhere safe) |
| Encoding | UTF8 (default) |
| Privileges | ALL on this database (default) |

Save → aaPanel runs `CREATE USER` + `CREATE DATABASE` + `GRANT ALL` for you.

## 3. Test the connection from your VPS shell

```bash
psql -h localhost -U cristina_app -d cristina_prod
# enter the password
# you should see: cristina_prod=>
\q   # exit
```

## 4. Wire `.env` on the VPS

`/www/wwwroot/<your-node-project>/.env`:

```bash
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cristina_prod
DB_USER=cristina_app
DB_PASSWORD=<paste from step 2>
DB_SSL=false   # localhost — no SSL needed
```

## 5. Restart the Node app

```bash
pm2 reload all
pm2 logs --lines 50
```

Look for `Database synced` and `Server running on http://localhost:5000`.

## 6. Migrating data from SQLite (if you have dev data worth keeping)

If you've been running locally and want to bring your SQLite data into
Postgres on first deploy, the easiest path is:

### Option A: Skip — start fresh
Most likely what you want. SQLite dev data is throwaway. Just run the
new app against an empty Postgres DB and it auto-creates the schema.

### Option B: Migrate the data
```bash
# Locally — dump SQLite to SQL
cd server
sqlite3 database.sqlite .dump > dump.sql

# Postgres doesn't accept SQLite's dialect verbatim. Use pgloader,
# which understands both:
pgloader sqlite://database.sqlite \
  postgresql://cristina_app:PASSWORD@VPS_IP:5432/cristina_prod
```

(pgloader handles the schema differences. Install via `apt install pgloader`.)

## What the code does automatically on first boot

`server/models/index.js` runs migrations on every startup:

- `addIfMissing(...)` adds nullable columns idempotently — safe to re-run
- The Transactions.creatorId relaxation now branches by dialect:
  - SQLite → table rebuild (no ALTER COLUMN)
  - Postgres → `ALTER TABLE Transactions ALTER COLUMN creatorId DROP NOT NULL`
- emailVerified grandfather uses Sequelize User.update() — portable

You don't need to run any "initial migration" manually. First time the
Node app boots against an empty Postgres DB, Sequelize creates all tables
from the model definitions.

## Common gotchas

| Issue | Fix |
|---|---|
| `connection refused` on port 5432 | aaPanel Postgres not started — check `aaPanel → App Store → PostgreSQL → Started` |
| `password authentication failed` | Wrong password in `.env`. Reset via `aaPanel → PG Manager → reset password` |
| `database "cristina_prod" does not exist` | DB created with wrong name; check aaPanel PG Manager |
| `permission denied for schema public` | Postgres 15+ default — fix once: `psql -U postgres -d cristina_prod -c "GRANT ALL ON SCHEMA public TO cristina_app;"` |
| Slow queries on bundle / message lookup | Add an index — see step 7 |

## 7. Production indexes (after first deploy, optional)

Once you have real traffic, these speed up the hottest queries:

```sql
-- Connect: psql -U cristina_app -d cristina_prod
CREATE INDEX IF NOT EXISTS idx_messages_fan_creator ON "Messages" ("fanId", "creatorId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_transactions_user ON "Transactions" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_events_name_time ON "Events" ("name", "createdAt");
CREATE INDEX IF NOT EXISTS idx_posts_creator_sort ON "Posts" ("creatorId", "sortOrder");
```

(Sequelize already creates the PK + unique indexes. These are query-pattern
indexes for our specific access patterns.)
