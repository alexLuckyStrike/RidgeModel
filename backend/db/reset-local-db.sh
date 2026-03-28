#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL first (for example: brew install postgresql@15)."
  exit 1
fi

psql -v ON_ERROR_STOP=1 postgres \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loadtrain_user') THEN CREATE ROLE loadtrain_user LOGIN PASSWORD 'loadtrain_pass'; ELSE ALTER ROLE loadtrain_user WITH LOGIN PASSWORD 'loadtrain_pass'; END IF; END \$\$;" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='loadtrain' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS loadtrain;" \
  -c "CREATE DATABASE loadtrain OWNER loadtrain_user;"

PGPASSWORD=loadtrain_pass psql -h localhost -p 5432 -U loadtrain_user -d loadtrain -v ON_ERROR_STOP=1 -f backend/db/init.sql

echo "Local database reset complete: loadtrain (owner: loadtrain_user)."
