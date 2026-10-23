import asyncpg
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import get_conn
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    conn: asyncpg.Connection = Depends(get_conn),
):
    if creds is None:
        raise HTTPException(401, "Требуется авторизация")
    try:
        user_id = decode_access_token(creds.credentials)
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Недействительный токен")

    row = await conn.fetchrow(
        """
        SELECT u.id, u.email, u.first_name, u.last_name, u.is_active,
               COALESCE(array_agg(r.role_name) FILTER (WHERE r.id IS NOT NULL), '{}') AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY u.id
        """,
        user_id,
    )
    if row is None or not row["is_active"]:
        raise HTTPException(401, "Пользователь не найден или деактивирован")
    return dict(row)


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if not set(roles) & set(user["roles"]):
            raise HTTPException(403, "Недостаточно прав")
        return user
    return checker