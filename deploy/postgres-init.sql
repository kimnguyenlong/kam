-- Runs once on first Postgres init. Creates a second database for Ory Keto alongside the
-- main `kam` database (both owned by the POSTGRES_USER configured in docker-compose).
SELECT 'CREATE DATABASE keto'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keto')\gexec
