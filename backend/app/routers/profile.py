
import asyncpg

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.db import get_conn
from app.deps import get_current_user


router = APIRouter(tags=["profile"])


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(
        None, min_length=1, max_length=100
    )

    last_name: str | None = Field(
        None, min_length=1, max_length=100
    )

    email: EmailStr | None = None

    bio: str | None = Field(
        None, max_length=5000
    )


@router.get("/me")
async def get_profile(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await conn.fetchrow(
        """
        SELECT
            id,
            email,
            first_name,
            last_name,
            bio,
            date_joined,
            last_login,
            is_active
        FROM users
        WHERE id = $1
        """,
        user["id"],
    )

    if row is None:
        raise HTTPException(404, "User not found")

    result = dict(row)
    result["roles"] = user["roles"]

    return result


@router.patch("/me")
async def update_profile(
    body: ProfileUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    fields = body.model_dump(exclude_unset=True)

    if not fields:
        raise HTTPException(
            400,
            "No fields provided for update",
        )

    for field in ("first_name", "last_name"):
        if field in fields and fields[field] is None:
            raise HTTPException(
                400,
                f"{field} cannot be null",
            )

    if "email" in fields and fields["email"] is not None:
        fields["email"] = str(fields["email"]).lower()


    columns = {
        "first_name": "first_name",
        "last_name": "last_name",
        "email": "email",
        "bio": "bio",
    }

    assignments = []
    values = []

    for field, value in fields.items():
        assignments.append(
            f"{columns[field]} = ${len(values) + 1}"
        )
        values.append(value)

    values.append(user["id"])

    query = f"""
        UPDATE users
        SET {", ".join(assignments)}
        WHERE id = ${len(values)}
        RETURNING
            id,
            email,
            first_name,
            last_name,
            bio,
            date_joined,
            last_login,
            is_active
    """

    try:
        row = await conn.fetchrow(query, *values)

    except asyncpg.UniqueViolationError:
        raise HTTPException(
            409,
            "A user with this email already exists",
        )

    if row is None:
        raise HTTPException(404, "User not found")

    result = dict(row)
    result["roles"] = user["roles"]

    return result
