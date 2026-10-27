from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.db import get_conn
from app.deps import get_current_user
from app.security import create_access_token, hash_password, verify_password

#endpoints /auth/register, /auth/login, /auth/me

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)  # лимит bcrypt: 72 байта
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Literal["student", "instructor"] = "student"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

@router.post("/registr", status_code=201)
async def register(body: RegisterIn, conn: asyncpg.Connection = Depends(get_conn)):
    pwd_hash = await hash_password(body.password)
    try:
        async with conn.transaction():
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, password, first_name, last_name, is_active)
                VALUES ($1, $2, $3, $4, TRUE)
                RETURNING id
                """,
                body.email.lower(), pwd_hash, body.first_name, body.last_name,
            )
            await conn.execute(
                """
                INSERT INTO user_roles (user_id, role_id)
                SELECT $1, id FROM roles WHERE role_name = $2
                """,
                user_id, body.role,
            )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "A user with this email already exists")
    return {"id": user_id, "email": body.email.lower(), "role": body.role}

@router.post("/login")
async def login(body: LoginIn, conn: asyncpg.Connection = Depends(get_conn)):
    row = await conn.fetchrow(
        "SELECT id, password, is_active FROM users WHERE email = $1",
        body.email.lower(),
    )
    if row is None or not await verify_password(body.password, row["password"]):
        raise HTTPException(401, "Incorrect email or password")
    if not row["is_active"]:
        raise HTTPException(403, "Account deactivated")

    await conn.execute("UPDATE users SET last_login = now() WHERE id = $1", row["id"])
    return {"access_token": create_access_token(row["id"]), "token_type": "bearer"}

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
