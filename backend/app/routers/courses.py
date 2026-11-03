from typing import Literal, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_conn

router = APIRouter(tags=["courses"])

#endpoints /cateories /courses /courses/{course_id}

SORT_MAP = {
    "newest": "c.created_at DESC",
    "price_asc": "c.price ASC, c.id",
    "price_desc": "c.price DESC, c.id",
    "popular": "students DESC, c.id",
}

@router.get("/categories")
async def list_categories(conn: asyncpg.Connection = Depends(get_conn)):
    rows = await conn.fetch("SELECT id, name, slug FROM categories ORDER BY name")
    return [dict(r) for r in rows]

@router.get("/courses")
async def list_courses(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    level: Optional[Literal["beginner", "intermediate", "advanced"]] = None,
    price_min: Optional[float] = Query(None, ge=0),
    price_max: Optional[float] = Query(None, ge=0),
    sort: Literal["newest", "price_asc", "price_desc", "popular"] = "newest",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    conn: asyncpg.Connection = Depends(get_conn)):

    conditions, params = ["c.is_published = TRUE"], []

    if search: 
        params.append(f"%{search}%")
        n = len(params)
        conditions.append(f"(c.title ILIKE ${n} OR c.description ILIKE ${n})")
    if category_id is not None:
        params.append(category_id)
        conditions.append(f"c.category_id = ${len(params)}")
    if level:
        params.append(level)
        conditions.append(f"c.level = ${len(params)}")
    if price_min is not None:
        params.append(price_min)
        conditions.append(f"c.price >= ${len(params)}")
    if price_max is not None:
        params.append(price_max)
        conditions.append(f"c.price <= ${len(params)}")

    where = " AND ".join(conditions)
    order_by = SORT_MAP[sort]

    total = await conn.fetchval(
        f"SELECT count(*) FROM courses c WHERE {where}", *params
    )

    params += [limit, offset]

    rows = await conn.fetch(
        f"""
        SELECT c.id, c.title, c.description, c.price, c.level, c.created_at,
               cat.id AS category_id, cat.name AS category_name,
               u.first_name || ' ' || u.last_name AS instructor_name,
               (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id) AS students
        FROM courses c
        JOIN categories cat ON cat.id = c.category_id
        JOIN users u ON u.id = c.instructor_id
        WHERE {where}
        ORDER BY {order_by}
        LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )

    return {"total": total, "items": [dict(r) for r in rows]}


@router.get("/courses/{course_id}")
async def get_course(course_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    course = await conn.fetchrow(
        """
        SELECT c.id, c.title, c.description, c.price, c.level, c.created_at,
               c.updated_at, c.is_published, c.instructor_id,
               cat.id AS category_id, cat.name AS category_name,
               u.first_name || ' ' || u.last_name AS instructor_name,
               u.bio AS instructor_bio,
               (SELECT count(*) FROM enrollments e WHERE e.course_id = c.id) AS students
        FROM courses c
        JOIN categories cat ON cat.id = c.category_id
        JOIN users u ON u.id = c.instructor_id
        WHERE c.id = $1 AND c.is_published = TRUE
        """,
        course_id,
    )
    if course is None:
        raise HTTPException(404, "Course not found")

    rows = await conn.fetch(
        """
        SELECT m.id AS module_id, m.title AS module_title,
               m.description AS module_description, m.order_in_course,
               l.id AS lesson_id, l.title AS lesson_title,
               l.duration, l.order_in_module
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
            "id": r["module_id"],
            "title": r["module_title"],
            "description": r["module_description"],
            "order": r["order_in_course"],
            "lessons": [],
        })
        if r["lesson_id"] is not None:
            mod["lessons"].append({
                "id": r["lesson_id"],
                "title": r["lesson_title"],
                "duration": r["duration"],
                "order": r["order_in_module"],
            })

    result = dict(course)
    result["modules"] = list(modules.values())
    return result


    
