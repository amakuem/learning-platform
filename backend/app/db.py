import asyncpg
from fastapi import Request

from app.config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
    )


async def get_conn(request: Request):
    """Зависимость FastAPI: выдаёт соединение из пула на время запроса."""
    async with request.app.state.pool.acquire() as conn:
        yield conn