import asyncpg
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.db import get_conn
from app.deps import get_current_user, require_role

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])

USER_SELECT = """
SELECT u.id, u.email, u.first_name, u.last_name, u.bio, u.date_joined,
       u.last_login, u.is_active,
       ARRAY(SELECT r.role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = u.id ORDER BY r.role_name) AS roles
FROM users u
"""

@router.get("/users")
async def get_all_users(
    search: str = "", role: str | None = None, active: bool | None = None,
    limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
    conn: asyncpg.Connection = Depends(get_conn),
):
    rows = await conn.fetch(USER_SELECT + """
        WHERE (u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1
               OR (u.first_name || ' ' || u.last_name) ILIKE $1)
        AND ($2::text IS NULL OR EXISTS (
            SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id AND r.role_name = $2))
        AND ($3::boolean IS NULL OR u.is_active = $3)
        ORDER BY u.id LIMIT $4 OFFSET $5
        """, f"%{search.strip()}%", role, active, limit, offset)
    return [dict(row) for row in rows]

@router.get("/users/{user_id}")
async def get_user_by_id(user_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    row = await conn.fetchrow(USER_SELECT + " WHERE u.id = $1", user_id)
    if row is None:
        raise HTTPException(404, "User not found")
    return dict(row)

class AdminUserUpdate(BaseModel):
    is_active: bool
    roles: list[str] = Field(min_length=1, max_length=1)

@router.patch("/users/{user_id}")
async def update_user(
    user_id: int, body: AdminUserUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    if user_id == user["id"] and (not body.is_active or "admin" not in body.roles):
        raise HTTPException(400, "Нельзя отключить свой аккаунт или снять с себя роль администратора.")
    async with conn.transaction():
        if not await conn.fetchval("SELECT id FROM users WHERE id = $1 FOR UPDATE", user_id):
            raise HTTPException(404, "User not found")
        roles = await conn.fetch("SELECT id, role_name FROM roles WHERE role_name = ANY($1::text[])", body.roles)
        if {r["role_name"] for r in roles} != set(body.roles):
            raise HTTPException(422, "Неизвестная роль.")
        await conn.execute("UPDATE users SET is_active = $1 WHERE id = $2", body.is_active, user_id)
        await conn.execute("DELETE FROM user_roles WHERE user_id = $1", user_id)
        await conn.executemany("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
                              [(user_id, role["id"]) for role in roles])
    return await get_user_by_id(user_id, conn)

@router.get("/roles")
async def get_all_roles(conn: asyncpg.Connection = Depends(get_conn)):
    return [dict(row) for row in await conn.fetch("SELECT id, role_name FROM roles ORDER BY id")]

@router.get("/logs")
async def get_all_logs(
    user_id: int | None = None, action: str = "", resource_type: str = "",
    start: datetime | None = None, end: datetime | None = None,
    limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
    conn: asyncpg.Connection = Depends(get_conn),
):
    if start and end and start > end:
        raise HTTPException(422, "Начало периода должно быть раньше окончания.")
    rows = await conn.fetch("""
        SELECT l.id, l.user_id, u.email, l.action, l.resource_type, l.resource_id, l.created_at
        FROM useractivitylogs l LEFT JOIN users u ON u.id = l.user_id
        WHERE ($1::bigint IS NULL OR l.user_id = $1)
          AND l.action ILIKE $2 AND COALESCE(l.resource_type, '') ILIKE $3
          AND ($4::timestamptz IS NULL OR l.created_at >= $4)
          AND ($5::timestamptz IS NULL OR l.created_at <= $5)
        ORDER BY l.created_at DESC, l.id DESC LIMIT $6 OFFSET $7
        """, user_id, f"%{action.strip()}%", f"%{resource_type.strip()}%", start, end, limit, offset)
    return [dict(row) for row in rows]

@router.get("/logs/options")
async def get_log_options(conn: asyncpg.Connection = Depends(get_conn)):
    actions = await conn.fetch(
        "SELECT DISTINCT action FROM useractivitylogs WHERE action IS NOT NULL AND action <> '' ORDER BY action"
    )
    resources = await conn.fetch(
        "SELECT DISTINCT resource_type FROM useractivitylogs "
        "WHERE resource_type IS NOT NULL AND resource_type <> '' ORDER BY resource_type"
    )
    return {
        "actions": [row["action"] for row in actions],
        "resource_types": [row["resource_type"] for row in resources],
    }

@router.get("/discussions")
async def list_discussions(
    search: str = "", limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
    conn: asyncpg.Connection = Depends(get_conn),
):
    rows = await conn.fetch("""
        SELECT d.id, d.question_text, d.parent_id, d.created_at, d.lesson_id,
               u.email, u.first_name, u.last_name, l.title AS lesson_title
        FROM discussions d JOIN users u ON u.id = d.user_id JOIN lessons l ON l.id = d.lesson_id
        WHERE d.question_text ILIKE $1 OR u.email ILIKE $1
        ORDER BY d.created_at DESC, d.id DESC LIMIT $2 OFFSET $3
        """, f"%{search.strip()}%", limit, offset)
    return [dict(row) for row in rows]
