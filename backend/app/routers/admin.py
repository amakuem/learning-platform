import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_conn
from app.deps import require_role

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])

#endpoints /admin/users /admin/users/{user_id} /admin/roles

@router.get("/users")
async def get_all_users(conn: asyncpg.Connection = Depends(get_conn)):
    rows = await conn.fetch(
        "SELECT id, email, first_name, last_name, bio, date_joined, last_login, is_active FROM users"
    )
    return [dict(r) for r in rows]

@router.get("/users/{user_id}")
async def get_user_by_id(user_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    row = await conn.fetchrow(
        "SELECT id, email, first_name, last_name, bio, date_joined, last_login, is_active FROM users where id = $1", user_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


@router.get("/roles")
async def get_all_roles(conn: asyncpg.Connection = Depends(get_conn)):
    rows = await conn.fetch(
        "SELECT id, role_name FROM roles"
    ) 
    return [dict(r) for r in rows]

@router.get("/logs")
async def get_all_logs(conn: asyncpg.Connection = Depends(get_conn)):
    rows = await conn.fetch(
            "SELECT id, user_id, action, resource_type, resource_id, created_at FROM useractivitylogs"
        ) 
    return [dict(r) for r in rows]