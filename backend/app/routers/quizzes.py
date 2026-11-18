import json
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_conn
from app.deps import get_current_user
from app.routers.learning import lock_enrollment, refresh_progress

router = APIRouter(tags=["quizzes"])

#endpoints /lessons/{id}/quiz /quizzes/{id}/attempt(post) /quizzes/{id}/attempts(get)

class AttemptIn(BaseModel):
    answers: dict[int, list[int]]	

def _parse_answers(raw) -> list[dict]:
    if raw is None:
        return []
    return json.loads(raw) if isinstance(raw, str) else raw 

async def _has_access(conn, user: dict, lesson_id: int) -> bool:
    row = await conn.fetchrow(
        """
        SELECT c.instructor_id,
               EXISTS (SELECT 1 FROM enrollments e
                       WHERE e.course_id = c.id AND e.user_id = $2) AS enrolled
        FROM lessons l
        JOIN modules m ON m.id = l.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE l.id = $1
        """,
        lesson_id, user["id"],
    )
    if row is None:
        raise HTTPException(404, "Lesson not found")
    return row["enrolled"] or row["instructor_id"] == user["id"] or "admin" in user["roles"]

@router.get("/lessons/{lesson_id}/quiz")
async def get_quiz(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    if not await _has_access(conn, user, lesson_id):
        raise HTTPException(403, "Enroll in the course to take the test")

    quiz = await conn.fetchrow(
        "SELECT id, title, passing_score FROM quizzes WHERE lesson_id = $1 ORDER BY id LIMIT 1", lesson_id
    )
    if quiz is None:
        raise HTTPException(404, "This lesson has no test")

    return await quiz_with_questions(conn, quiz)


@router.get("/lessons/{lesson_id}/quizzes")
async def get_lesson_quizzes(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    if not await _has_access(conn, user, lesson_id):
        raise HTTPException(403, "Enroll in the course to take the test")
    quizzes = await conn.fetch("""
        SELECT q.id, q.title, q.passing_score, EXISTS (
            SELECT 1 FROM quiz_attempts a
            WHERE a.quiz_id = q.id AND a.user_id = e.user_id AND a.is_passed
              AND a.attempt_date >= e.enrollment_date
        ) AS passed
        FROM quizzes q
        JOIN lessons l ON l.id = q.lesson_id
        JOIN modules m ON m.id = l.module_id
        LEFT JOIN enrollments e ON e.course_id = m.course_id AND e.user_id = $2
        WHERE q.lesson_id = $1 ORDER BY q.id
        """, lesson_id, user["id"])
    return [await quiz_with_questions(conn, quiz) for quiz in quizzes]


async def quiz_with_questions(conn, quiz):
    rows = await conn.fetch(
        "SELECT id, text, points, answers FROM questions WHERE quiz_id = $1 ORDER BY id",
        quiz["id"],
    )
    questions = []
    for r in rows:
        options = _parse_answers(r["answers"])
        questions.append({
            "id": r["id"],
            "text": r["text"],
            "points": r["points"],
            "options": [{"id": o["id"], "text": o["text"]} for o in options],
            "multiple": sum(1 for o in options if o.get("is_correct")) > 1,
        })

    result = dict(quiz)
    result["questions"] = questions
    return result

@router.post("/quizzes/{quiz_id}/attempt")
async def submit_attempt(
    quiz_id: int,
    body: AttemptIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    quiz = await conn.fetchrow(
        "SELECT id, lesson_id, passing_score FROM quizzes WHERE id = $1", quiz_id
    )
    if quiz is None:
        raise HTTPException(404, "Test not found")

    enrolled = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM lessons l
            JOIN modules m ON m.id = l.module_id
            JOIN enrollments e ON e.course_id = m.course_id AND e.user_id = $2
            WHERE l.id = $1)
        """,
        quiz["lesson_id"], user["id"],
    )
    if not enrolled:
        raise HTTPException(403, "You are not enrolled in this course")

    questions = await conn.fetch(
        "SELECT id, points, answers FROM questions WHERE quiz_id = $1", quiz_id
    )
    if not questions:
        raise HTTPException(400, "There are no questions in the test.")

    total_points = 0
    earned_points = 0
    review = []
    for q in questions:
        correct_ids = {o["id"] for o in _parse_answers(q["answers"]) if o.get("is_correct")}
        selected = set(body.answers.get(q["id"], []))
        is_correct = selected == correct_ids
        total_points += q["points"]
        if is_correct:
            earned_points += q["points"]
        review.append({"question_id": q["id"], "is_correct": is_correct})

    score = Decimal(earned_points * 100 / total_points).quantize(Decimal("0.01"))
    is_passed = score >= quiz["passing_score"]

    async with conn.transaction():
        enrollment = await lock_enrollment(conn, user["id"], quiz["lesson_id"])
        attempt = await conn.fetchrow(
            """
            INSERT INTO quiz_attempts (user_id, quiz_id, score, is_passed, attempt_date)
            VALUES ($1, $2, $3, $4, clock_timestamp())
            RETURNING id, attempt_date
            """,
            user["id"], quiz_id, score, is_passed,
        )
        await refresh_progress(conn, enrollment, quiz["lesson_id"])
    return {
        "attempt_id": attempt["id"],
        "score": score,
        "is_passed": is_passed,
        "passing_score": quiz["passing_score"],
        "earned_points": earned_points,
        "total_points": total_points,
        "review": review,
        "attempt_date": attempt["attempt_date"],
    }

@router.get("/quizzes/{quiz_id}/attempts")
async def my_attempts(
    quiz_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    rows = await conn.fetch(
        """
        SELECT id, score, is_passed, attempt_date
        FROM quiz_attempts
        WHERE user_id = $1 AND quiz_id = $2
        ORDER BY attempt_date DESC, id DESC
        """,
        user["id"], quiz_id,
    )
    return [dict(r) for r in rows]
