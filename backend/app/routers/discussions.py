
import asyncpg

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import get_current_user


router = APIRouter(tags=["discussions"])


class DiscussionIn(BaseModel):
    question_text: str = Field(min_length=1, max_length=10000)
    parent_id: int | None = Field(None, ge=1)


async def check_lesson_access(
    conn: asyncpg.Connection,
    lesson_id: int,
    user: dict,
):

    lesson = await conn.fetchrow(
        """
        SELECT l.id, c.instructor_id
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE l.id = $1
        """,
        lesson_id,
    )

    if lesson is None:
        raise HTTPException(404, "Lesson not found")

    is_owner = lesson["instructor_id"] == user["id"]
    is_admin = "admin" in user["roles"]

    if not is_owner and not is_admin:
        enrolled = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1
                FROM enrollments e
                JOIN modules m ON m.course_id = e.course_id
                JOIN lessons l ON l.module_id = m.id
                WHERE e.user_id = $1 AND l.id = $2
            )
            """,
            user["id"],
            lesson_id,
        )

        if not enrolled:
            raise HTTPException(
                403,
                "Enroll in the course to access discussions",
            )


@router.get("/lessons/{lesson_id}/discussions")
async def get_discussions(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_lesson_access(conn, lesson_id, user)

    rows = await conn.fetch(
        """
        SELECT
            d.id,
            d.question_text,
            d.created_at,
            d.user_id,
            d.lesson_id,
            d.parent_id,
            u.first_name,
            u.last_name
        FROM discussions d
        JOIN users u ON u.id = d.user_id
        WHERE d.lesson_id = $1
        ORDER BY d.created_at ASC, d.id ASC
        """,
        lesson_id,
    )

    return [dict(r) for r in rows]


@router.post("/lessons/{lesson_id}/discussions", status_code=201)
async def create_discussion(
    lesson_id: int,
    body: DiscussionIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_lesson_access(conn, lesson_id, user)


    if body.parent_id is not None:
        parent = await conn.fetchrow(
            """
            SELECT id
            FROM discussions
            WHERE id = $1 AND lesson_id = $2
            """,
            body.parent_id,
            lesson_id,
        )

        if parent is None:
            raise HTTPException(
                404,
                "Parent discussion not found in this lesson",
            )

    row = await conn.fetchrow(
        """
        INSERT INTO discussions (
            question_text,
            user_id,
            lesson_id,
            parent_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, question_text, created_at,
                  user_id, lesson_id, parent_id
        """,
        body.question_text.strip(),
        user["id"],
        lesson_id,
        body.parent_id,
    )

    result = dict(row)
    result["first_name"] = user["first_name"]
    result["last_name"] = user["last_name"]

    return result


@router.delete("/discussions/{discussion_id}")
async def delete_discussion(
    discussion_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await conn.fetchrow(
        """
        SELECT id, user_id
        FROM discussions
        WHERE id = $1
        """,
        discussion_id,
    )

    if row is None:
        raise HTTPException(404, "Discussion not found")

    if row["user_id"] != user["id"]:
        raise HTTPException(
            403,
            "You can delete only your own messages",
        )

    await conn.execute(
        "DELETE FROM discussions WHERE id = $1",
        discussion_id,
    )

    return {"status": "deleted", "id": discussion_id}
