import json
from decimal import Decimal
from typing import Literal, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import get_current_user, require_role

router = APIRouter(
    prefix="/instructor",
    tags=["instructor"],
    dependencies=[Depends(require_role("instructor", "admin"))],
)

OWNER_SQL = {
    "course": "SELECT instructor_id FROM courses WHERE id = $1",
    "module": """SELECT c.instructor_id FROM modules m
                 JOIN courses c ON c.id = m.course_id WHERE m.id = $1""",
    "lesson": """SELECT c.instructor_id FROM lessons l
                 JOIN modules m ON m.id = l.module_id
                 JOIN courses c ON c.id = m.course_id WHERE l.id = $1""",
    "page": """SELECT c.instructor_id FROM lessonpages p
               JOIN lessons l ON l.id = p.lesson_id
               JOIN modules m ON m.id = l.module_id
               JOIN courses c ON c.id = m.course_id WHERE p.id = $1""",
    "section": """SELECT c.instructor_id FROM pagesections s
                  JOIN lessonpages p ON p.id = s.page_id
                  JOIN lessons l ON l.id = p.lesson_id
                  JOIN modules m ON m.id = l.module_id
                  JOIN courses c ON c.id = m.course_id WHERE s.section_id = $1""",
    "quiz": """SELECT c.instructor_id FROM quizzes q
               JOIN lessons l ON l.id = q.lesson_id
               JOIN modules m ON m.id = l.module_id
               JOIN courses c ON c.id = m.course_id WHERE q.id = $1""",
    "question": """SELECT c.instructor_id FROM questions qu
                   JOIN quizzes q ON q.id = qu.quiz_id
                   JOIN lessons l ON l.id = q.lesson_id
                   JOIN modules m ON m.id = l.module_id
                   JOIN courses c ON c.id = m.course_id WHERE qu.id = $1""",
}

async def check_owner(conn, kind: str, entity_id: int, user: dict):
    """404, если сущности нет; 403, если она принадлежит чужому курсу."""
    owner_id = await conn.fetchval(OWNER_SQL[kind], entity_id)
    if owner_id is None:
        raise HTTPException(404, "Object not found")
    if owner_id != user["id"] and "admin" not in user["roles"]:
        raise HTTPException(403, "This is not your course")

async def next_order(conn, table: str, col: str, parent_col: str, parent_id: int) -> int:
    return await conn.fetchval(
        f"SELECT COALESCE(MAX({col}), 0) + 1 FROM {table} WHERE {parent_col} = $1",
        parent_id,
    )

def changes(body: BaseModel, nullable: tuple = ()) -> dict:
    """Только переданные поля; None допустим лишь для необязательных столбцов."""
    return {
        k: v for k, v in body.model_dump(exclude_unset=True).items()
        if v is not None or k in nullable
    }

async def update_row(conn, table: str, pk: str, row_id: int, fields: dict, extra: str = ""):
    if not fields:
        raise HTTPException(400, "Fields for modification have not been provided")
    sets = [f"{col} = ${i}" for i, col in enumerate(fields, 1)]
    row = await conn.fetchrow(
        f"UPDATE {table} SET {', '.join(sets)}{extra} WHERE {pk} = ${len(fields) + 1} RETURNING *",
        *fields.values(), row_id,
    )
    return dict(row)

async def delete_row(conn, table: str, pk: str, row_id: int):
    await conn.execute(f"DELETE FROM {table} WHERE {pk} = $1", row_id)
    return {"status": "deleted"}


Level = Literal["beginner", "intermediate", "advanced"]


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price: Decimal = Field(Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    level: Level
    category_id: int


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    level: Optional[Level] = None
    category_id: Optional[int] = None


class ModuleIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    order_in_course: Optional[int] = Field(None, ge=1)


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    order_in_course: Optional[int] = Field(None, ge=1)


class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    duration: int = Field(0, ge=0)
    order_in_module: Optional[int] = Field(None, ge=1)


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    duration: Optional[int] = Field(None, ge=0)
    order_in_module: Optional[int] = Field(None, ge=1)


class PageIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    order_in_lesson: Optional[int] = Field(None, ge=1)


class PageUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    order_in_lesson: Optional[int] = Field(None, ge=1)


class SectionIn(BaseModel):
    section_type: Literal["text", "code"]
    content: Optional[str] = None
    video_url: Optional[str] = Field(None, max_length=500)
    section_order: Optional[int] = Field(None, ge=1)


class SectionUpdate(BaseModel):
    section_type: Optional[Literal["text", "code"]] = None
    content: Optional[str] = None
    video_url: Optional[str] = Field(None, max_length=500)
    section_order: Optional[int] = Field(None, ge=1)


class QuizIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    passing_score: int = Field(70, ge=0, le=100)


class OptionIn(BaseModel):
    text: str = Field(min_length=1)
    is_correct: bool = False


def _options_json(options: list[OptionIn]) -> str:
    """Проверяет варианты и формирует JSON; id вариантов назначает сервер."""
    if len(options) < 2:
        raise HTTPException(400, "Нужно минимум два варианта ответа")
    if not any(o.is_correct for o in options):
        raise HTTPException(400, "Отметьте хотя бы один правильный вариант")
    return json.dumps(
        [{"id": i, "text": o.text, "is_correct": o.is_correct}
         for i, o in enumerate(options, 1)],
        ensure_ascii=False,
    )

class QuestionIn(BaseModel):
    text: str = Field(min_length=1)
    points: int = Field(1, ge=1)
    options: list[OptionIn]


class QuestionUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    points: Optional[int] = Field(None, ge=1)
    options: Optional[list[OptionIn]] = None


# ---------- курсы ----------

@router.get("/courses")
async def my_courses(
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Все курсы преподавателя, включая черновики."""
    rows = await conn.fetch(
        """
        SELECT c.id, c.title, c.price, c.level, c.is_published,
               c.created_at, c.updated_at,
               (SELECT count(*) FROM modules m WHERE m.course_id = c.id) AS modules_count,
               (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id) AS students
        FROM courses c
        WHERE c.instructor_id = $1
        ORDER BY c.created_at DESC
        """,
        user["id"],
    )
    return [dict(r) for r in rows]

@router.post("/courses", status_code=201)
async def create_course(
    body: CourseIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    row = await conn.fetchrow(
        """
        INSERT INTO courses (title, description, price, level, instructor_id, category_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, description, price, level, category_id, is_published
        """,
        body.title, body.description, body.price, body.level, user["id"], body.category_id,
    )
    return dict(row)

@router.get("/courses/{course_id}")
async def get_my_course(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Курс со всей структурой для редактора (в том числе черновик)."""
    await check_owner(conn, "course", course_id, user)
    course = await conn.fetchrow(
        """
        SELECT id, title, description, price, level, category_id,
               is_published, created_at, updated_at
        FROM courses WHERE id = $1
        """,
        course_id,
    )
    rows = await conn.fetch(
        """
        SELECT m.id AS module_id, m.title AS module_title,
               m.description AS module_description, m.order_in_course,
               l.id AS lesson_id, l.title AS lesson_title, l.duration, l.order_in_module,
               EXISTS (SELECT 1 FROM quizzes q WHERE q.lesson_id = l.id) AS has_quiz
        FROM modules m
        LEFT JOIN lessons l ON l.module_id = m.id
        WHERE m.course_id = $1
        ORDER BY m.order_in_course, l.order_in_module
        """,
        course_id,
    )
    modules: dict[int, dict] = {}
    for r in rows:
        mod = modules.setdefault(r["module_id"], {
            "id": r["module_id"], "title": r["module_title"],
            "description": r["module_description"],
            "order": r["order_in_course"], "lessons": [],
        })
        if r["lesson_id"] is not None:
            mod["lessons"].append({
                "id": r["lesson_id"], "title": r["lesson_title"],
                "duration": r["duration"], "order": r["order_in_module"],
                "has_quiz": r["has_quiz"],
            })
    result = dict(course)
    result["modules"] = list(modules.values())
    return result

@router.patch("/courses/{course_id}")
async def update_course(
    course_id: int, body: CourseUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    return await update_row(
        conn, "courses", "id", course_id, changes(body), extra=", updated_at = now()"
    )

@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    return await delete_row(conn, "courses", "id", course_id)

@router.post("/courses/{course_id}/publish")
async def publish_course(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    lessons = await conn.fetchval(
        """
        SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
        """,
        course_id,
    )
    if lessons == 0:
        raise HTTPException(400, "Нельзя опубликовать курс без уроков")
    await conn.execute(
        "UPDATE courses SET is_published = TRUE, updated_at = now() WHERE id = $1",
        course_id,
    )
    return {"id": course_id, "is_published": True}

@router.post("/courses/{course_id}/unpublish")
async def unpublish_course(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    await conn.execute(
        "UPDATE courses SET is_published = FALSE, updated_at = now() WHERE id = $1",
        course_id,
    )
    return {"id": course_id, "is_published": False}

@router.get("/courses/{course_id}/stats")
async def course_stats(
    course_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    total_lessons = await conn.fetchval(
        """
        SELECT count(*) FROM lessons l JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = $1
        """,
        course_id,
    )
    rows = await conn.fetch(
        """
        SELECT u.id AS user_id, u.first_name, u.last_name, u.email,
               e.enrollment_date, e.completion_status,
               count(lp.id) FILTER (WHERE lp.status = 'completed') AS completed_lessons,
               (SELECT round(avg(qa.score), 2)
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                JOIN lessons l ON l.id = q.lesson_id
                JOIN modules m ON m.id = l.module_id
                WHERE m.course_id = e.course_id AND qa.user_id = e.user_id) AS avg_quiz_score
        FROM enrollments e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id
        WHERE e.course_id = $1
        GROUP BY e.id, u.id
        ORDER BY e.enrollment_date
        """,
        course_id,
    )
    students = []
    for r in rows:
        d = dict(r)
        d["progress_percent"] = (
            round(d["completed_lessons"] * 100 / total_lessons) if total_lessons else 0
        )
        students.append(d)
    return {
        "course_id": course_id,
        "total_lessons": total_lessons,
        "students_count": len(students),
        "completed_count": sum(1 for s in students if s["completion_status"] == "completed"),
        "students": students,
    }

# ---------- модули ----------

@router.post("/courses/{course_id}/modules", status_code=201)
async def create_module(
    course_id: int, body: ModuleIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "course", course_id, user)
    order = body.order_in_course or await next_order(
        conn, "modules", "order_in_course", "course_id", course_id)
    row = await conn.fetchrow(
        """
        INSERT INTO modules (title, description, order_in_course, course_id)
        VALUES ($1, $2, $3, $4) RETURNING *
        """,
        body.title, body.description, order, course_id,
    )
    return dict(row)

@router.patch("/modules/{module_id}")
async def update_module(
    module_id: int, body: ModuleUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "module", module_id, user)
    return await update_row(conn, "modules", "id", module_id,
                            changes(body, nullable=("description",)))

@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "module", module_id, user)
    return await delete_row(conn, "modules", "id", module_id)

# ---------- уроки ----------

@router.post("/modules/{module_id}/lessons", status_code=201)
async def create_lesson(
    module_id: int, body: LessonIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "module", module_id, user)
    order = body.order_in_module or await next_order(
        conn, "lessons", "order_in_module", "module_id", module_id)
    row = await conn.fetchrow(
        """
        INSERT INTO lessons (title, duration, order_in_module, module_id)
        VALUES ($1, $2, $3, $4) RETURNING *
        """,
        body.title, body.duration, order, module_id,
    )
    return dict(row)

@router.get("/lessons/{lesson_id}")
async def get_my_lesson(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Урок со страницами и секциями для редактора."""
    await check_owner(conn, "lesson", lesson_id, user)
    lesson = await conn.fetchrow(
        "SELECT id, title, duration, order_in_module, module_id FROM lessons WHERE id = $1",
        lesson_id,
    )
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
    result = dict(lesson)
    result["pages"] = list(pages.values())
    return result

@router.patch("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: int, body: LessonUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "lesson", lesson_id, user)
    return await update_row(conn, "lessons", "id", lesson_id, changes(body))

@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "lesson", lesson_id, user)
    return await delete_row(conn, "lessons", "id", lesson_id)

# ---------- страницы ----------

@router.post("/lessons/{lesson_id}/pages", status_code=201)
async def create_page(
    lesson_id: int, body: PageIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "lesson", lesson_id, user)
    order = body.order_in_lesson or await next_order(
        conn, "lessonpages", "order_in_lesson", "lesson_id", lesson_id)
    row = await conn.fetchrow(
        """
        INSERT INTO lessonpages (title, order_in_lesson, lesson_id)
        VALUES ($1, $2, $3) RETURNING *
        """,
        body.title, order, lesson_id,
    )
    return dict(row)


@router.patch("/pages/{page_id}")
async def update_page(
    page_id: int, body: PageUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "page", page_id, user)
    return await update_row(conn, "lessonpages", "id", page_id, changes(body))


@router.delete("/pages/{page_id}")
async def delete_page(
    page_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "page", page_id, user)
    return await delete_row(conn, "lessonpages", "id", page_id)


# ---------- секции ----------

@router.post("/pages/{page_id}/sections", status_code=201)
async def create_section(
    page_id: int, body: SectionIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "page", page_id, user)
    order = body.section_order or await next_order(
        conn, "pagesections", "section_order", "page_id", page_id)
    row = await conn.fetchrow(
        """
        INSERT INTO pagesections (section_type, content, section_order, video_url, page_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
        """,
        body.section_type, body.content, order, body.video_url, page_id,
    )
    return dict(row)


@router.patch("/sections/{section_id}")
async def update_section(
    section_id: int, body: SectionUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "section", section_id, user)
    return await update_row(conn, "pagesections", "section_id", section_id,
                            changes(body, nullable=("content", "video_url")))


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "section", section_id, user)
    return await delete_row(conn, "pagesections", "section_id", section_id)


# ---------- тесты ----------

@router.get("/lessons/{lesson_id}/quiz")
async def get_my_quiz(
    lesson_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Тест для редактора: в отличие от студенческой выдачи, с is_correct."""
    await check_owner(conn, "lesson", lesson_id, user)
    quiz = await conn.fetchrow(
        "SELECT id, title, passing_score FROM quizzes WHERE lesson_id = $1", lesson_id
    )
    if quiz is None:
        raise HTTPException(404, "У этого урока нет теста")
    rows = await conn.fetch(
        "SELECT id, text, points, answers FROM questions WHERE quiz_id = $1 ORDER BY id",
        quiz["id"],
    )
    result = dict(quiz)
    result["questions"] = [
        {"id": r["id"], "text": r["text"], "points": r["points"],
         "options": json.loads(r["answers"]) if r["answers"] else []}
        for r in rows
    ]
    return result


@router.put("/lessons/{lesson_id}/quiz")
async def upsert_quiz(
    lesson_id: int, body: QuizIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    """Создаёт тест урока или обновляет существующий (у урока один тест)."""
    await check_owner(conn, "lesson", lesson_id, user)
    async with conn.transaction():
        quiz_id = await conn.fetchval("SELECT id FROM quizzes WHERE lesson_id = $1", lesson_id)
        if quiz_id is None:
            row = await conn.fetchrow(
                """
                INSERT INTO quizzes (title, passing_score, lesson_id)
                VALUES ($1, $2, $3) RETURNING id, title, passing_score
                """,
                body.title, body.passing_score, lesson_id,
            )
        else:
            row = await conn.fetchrow(
                """
                UPDATE quizzes SET title = $1, passing_score = $2
                WHERE id = $3 RETURNING id, title, passing_score
                """,
                body.title, body.passing_score, quiz_id,
            )
    return dict(row)


@router.post("/quizzes/{quiz_id}/questions", status_code=201)
async def create_question(
    quiz_id: int, body: QuestionIn,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "quiz", quiz_id, user)
    row = await conn.fetchrow(
        """
        INSERT INTO questions (text, points, answers, quiz_id)
        VALUES ($1, $2, $3, $4) RETURNING id, text, points, answers
        """,
        body.text, body.points, _options_json(body.options), quiz_id,
    )
    d = dict(row)
    d["options"] = json.loads(d.pop("answers"))
    return d


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: int, body: QuestionUpdate,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "question", question_id, user)
    fields = changes(body)
    if "options" in fields:
        fields["answers"] = _options_json(body.options)
        del fields["options"]
    row = await update_row(conn, "questions", "id", question_id, fields)
    row["options"] = json.loads(row.pop("answers")) if row.get("answers") else []
    return row


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: int,
    user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_conn),
):
    await check_owner(conn, "question", question_id, user)
    return await delete_row(conn, "questions", "id", question_id)