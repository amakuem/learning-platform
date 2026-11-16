import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { coursePageSize, getCourses, type CourseSummary } from "../api/courses";
import PageLayout from "./PageLayout";
import "./home.css";

const levelNames: Record<CourseSummary["level"], string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

function Home() {
  const [page, setPage] = useState(0);
  const offset = page * coursePageSize;
  const courses = useQuery({
    queryKey: ["courses", offset],
    queryFn: ({ signal }) => getCourses(offset, signal),
    retry: false,
  });
  const data = courses.data;

  return (
    <PageLayout catalog>
      <section id="courses" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <h1 id="catalog-title">Каталог курсов</h1>
          <p>Выберите курс по теме и уровню подготовки.</p>
        </div>

        {courses.isPending && <p className="catalog-state" role="status">Загружаем курсы…</p>}
        {courses.isError && (
          <div className="catalog-state">
            <p role="alert">Не удалось загрузить курсы.</p>
            <button className="catalog-button" type="button" onClick={() => void courses.refetch()}>
              Повторить
            </button>
          </div>
        )}
        {data && (
          <>
            {data.items.length === 0 ? (
              <p className="catalog-state" role="status">
                {page === 0 ? "Опубликованных курсов пока нет." : "На этой странице больше нет курсов."}
              </p>
            ) : (
              <ul className="course-grid">
                {data.items.map((course) => (
                  <li className="course-card" key={course.id}>
                    <span className="course-category">{course.category_name}</span>
                    <h2>{course.title}</h2>
                    {course.description && <p className="course-description">{course.description}</p>}
                    <div className="course-meta">
                      <span>{levelNames[course.level]}</span>
                      <span>{course.instructor_name}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(page > 0 || offset + coursePageSize < data.total) && (
              <nav className="catalog-pagination" aria-label="Страницы каталога">
                <button className="catalog-button" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Назад
                </button>
                <span>Страница {page + 1}</span>
                <button className="catalog-button" type="button" disabled={offset + coursePageSize >= data.total} onClick={() => setPage(page + 1)}>
                  Далее
                </button>
              </nav>
            )}
          </>
        )}
        {courses.isError && !data && page > 0 && (
          <button className="catalog-button" type="button" onClick={() => setPage(page - 1)}>
            К предыдущей странице
          </button>
        )}
      </section>
    </PageLayout>
  );
}

export default Home;
