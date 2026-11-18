import asyncpg
from fastapi import Request

from app.config import settings


async def create_pool() -> asyncpg.Pool:
    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
    )
    try:
        await pool.execute("""
            CREATE TABLE IF NOT EXISTS lesson_page_views (
                enrollment_id BIGINT REFERENCES enrollments(id) ON DELETE CASCADE,
                page_id BIGINT REFERENCES lessonpages(id) ON DELETE CASCADE,
                PRIMARY KEY (enrollment_id, page_id)
            )
        """)
    except Exception:
        await pool.close()
        raise
    return pool



async def get_conn(request: Request):
    """Зависимость FastAPI: выдаёт соединение из пула на время запроса."""
    async with request.app.state.pool.acquire() as conn:
        yield conn