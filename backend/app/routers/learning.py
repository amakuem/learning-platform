import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import get_current_user

from typing import Literal

router = APIRouter(tags=["learning"])

#endpoints /courses/{id}/enroll(post) /courses/{id}/enroll(delete) /me/enrollments /lessons/{id} /lessons/{id}/progress

class ProgressIn(BaseModel):
    status: Literal["in_progress", "completed"]
    viewed_seconds: int = Field(0, ge=0)

@router.post("/courses/{course_id}/enroll", status_code=201)
async def enroll(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    published = await conn.fetchval(
        "SELECT is_published FROM courses WHERE id = $1", course_id
    )
    if not published:
        raise HTTPException(404, "Course not found")
    try:
        enrollment_id = await conn.fetchval(
            "INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING id",
            user["id"], course_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "You are already enrolled in this course")
    return {"enrollment_id": enrollment_id}

@router.delete("/courses/{course_id}/enroll")
async def unenroll(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    result = await conn.execute(
        "DELETE FROM enrollments WHERE user_id = $1 AND course_id = $2",
        user["id"], course_id,
    )
    if result == "DELETE 0":
        raise HTTPException(404, "You are not enrolled in this course")
    return {"status": "unenrolled"}


@router.get("/me/enrollments")
async def my_enrollments(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    rows = await conn.fetch(
        """
        SELECT e.id AS enrollment_id, e.enrollment_date, e.completion_status,
               c.id AS course_id, c.title,
               count(l.id) AS total_lessons,
               count(lp.id) FILTER (WHERE lp.status = 'completed') AS completed_lessons
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN modules m ON m.course_id = c.id
        LEFT JOIN lessons l ON l.module_id = m.id
        LEFT JOIN lesson_progress lp
               ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
        WHERE e.user_id = $1
        GROUP BY e.id, c.id
        ORDER BY e.enrollment_date DESC
        """,
        user["id"],
    )
    result = []
    for r in rows:
        d = dict(r)
        total = d["total_lessons"]
        d["progress_percent"] = round(d["completed_lessons"] * 100 / total) if total else 0
        result.append(d)
    return result

async def _get_enrollment_for_lesson(conn, user_id: int, lesson_id: int):
    return await conn.fetchrow(
        """
        SELECT e.id AS enrollment_id, m.course_id
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        JOIN enrollments e ON e.course_id = m.course_id AND e.user_id = $1
        WHERE l.id = $2
        """,
        user_id, lesson_id,
    )

@router.get("/lessons/{lesson_id}")
async def get_lesson(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    lesson = await conn.fetchrow(
        """
        SELECT l.id, l.title, l.duration, m.course_id, c.instructor_id
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE l.id = $1
        """,
        lesson_id,
    )
    if lesson is None:
        raise HTTPException(404, "Lesson not found")

    enrollment = await _get_enrollment_for_lesson(conn, user["id"], lesson_id)
    is_owner = lesson["instructor_id"] == user["id"]
    if enrollment is None and not is_owner and "admin" not in user["roles"]:
        raise HTTPException(403, "Enroll in the course to unlock the lesson")

    rows = await conn.fetch(
        """
        SELECT p.id AS page_id, p.title AS page_title, p.order_in_lesson,
               s.section_id, s.section_type, s.content, s.video_url, s.section_order
        FROM lessonpages p
        LEFT JOIN pagesections s ON s.page_id = p.id
        WHERE p.lesson_id = $1
        ORDER BY p.order_in_lesson, s.section_order
        """,
        lesson_id,
    )
    pages: dict[int, dict] = {}
    for r in rows:
        page = pages.setdefault(r["page_id"], {
            "id": r["page_id"], "title": r["page_title"],
            "order": r["order_in_lesson"], "sections": [],
        })
        if r["section_id"] is not None:
            page["sections"].append({
                "id": r["section_id"], "type": r["section_type"],
                "content": r["content"], "video_url": r["video_url"],
                "order": r["section_order"],
            })

    progress = None
    if enrollment:
        progress = await conn.fetchval(
            "SELECT status FROM lesson_progress WHERE enrollment_id = $1 AND lesson_id = $2",
            enrollment["enrollment_id"], lesson_id,
        )

    result = dict(lesson)
    result.pop("instructor_id")
    result["pages"] = list(pages.values())
    result["progress_status"] = progress or "not_started"
    return result

@router.put("/lessons/{lesson_id}/progress")
async def update_progress(
    lesson_id: int,
    body: ProgressIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    enrollment = await _get_enrollment_for_lesson(conn, user["id"], lesson_id)
    if enrollment is None:
        raise HTTPException(403, "You are not enrolled in this course")

    async with conn.transaction():
        await conn.execute(
            """
            INSERT INTO lesson_progress
                (enrollment_id, lesson_id, status, last_viewed_at, viewed_duration)
            VALUES ($1, $2, $3, now(), $4)
            ON CONFLICT (enrollment_id, lesson_id) DO UPDATE SET
                status = CASE WHEN lesson_progress.status = 'completed'
                              THEN 'completed' ELSE EXCLUDED.status END,
                last_viewed_at = now(),
                viewed_duration = lesson_progress.viewed_duration + EXCLUDED.viewed_duration
            """,
            enrollment["enrollment_id"], lesson_id, body.status, body.viewed_seconds,
        )

        await conn.execute(
            """
            UPDATE enrollments e SET completion_status = 'completed'
            WHERE e.id = $1 AND e.completion_status <> 'completed'
              AND NOT EXISTS (
                  SELECT 1 FROM lessons l
                  JOIN modules m ON m.id = l.module_id
                  LEFT JOIN lesson_progress lp
                         ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
                  WHERE m.course_id = e.course_id
                    AND COALESCE(lp.status, 'not_started') <> 'completed'
              )
            """,
            enrollment["enrollment_id"],
        )
    return {"status": "ok"}