import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from app.config import settings


def get_conn():
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is missing in ai-service/.env")
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    register_vector(conn)  # numpy/list ko vector column mein bhejne ke liye
    return conn
