-- Runs once on first initialization of the Postgres data directory, as the
-- superuser, before the backend ever connects. pgvector/pgvector:pg17 ships the
-- extension binary; this guarantees it is enabled in cognee_db so the first
-- cognify has a working vector store. Cognee's pgvector adapter also runs
-- CREATE EXTENSION IF NOT EXISTS vector; itself, so this is belt-and-suspenders.
CREATE EXTENSION IF NOT EXISTS vector;
