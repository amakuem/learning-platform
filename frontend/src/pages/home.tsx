import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { courseLevels, coursePageSize, getCourses, type CourseFilters } from "../api/courses";
import CatalogFilters from "./CatalogFilters";
import PageLayout from "./PageLayout";
import { formatCoursePrice } from "./coursePrice";
import "./home.css";

function Home() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<CourseFilters>({});
  const offset = page * coursePageSize;
  const courses = useQuery({
    queryKey: ["courses", filters, offset],
    queryFn: ({ signal }) => getCourses(offset, signal, filters),
    retry: false,
  });
  const data = courses.data;
  const hasFilters = Boolean(filters.search || filters.category_id || filters.level ||
    filters.price_min !== undefined || filters.price_max !== undefined);

  return (
    <PageLayout catalog>
      <section id="courses" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <h1 id="catalog-title">Каталог курсов</h1>
        </div>
        <CatalogFilters onApply={(nextFilters) => {
          setFilters(nextFilters);
          setPage(0);
        }} />

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
            {data.items.length > 0 && (
              <p className="catalog-results" role="status">Найдено курсов: {data.total}</p>
            )}
            {data.items.length === 0 ? (
              <p className="catalog-state" role="status">
                {page === 0 && !hasFilters ? "Опубликованных курсов пока нет." : "По этим параметрам курсы не найдены."}
              </p>
            ) : (
              <ul className="course-grid">
                {data.items.map((course) => (
                  <li className="course-card" key={course.id}>
                    <span className="course-category">{course.category_name}</span>
                    <h2><Link className="course-card-link" to={`/courses/${course.id}`}>{course.title}</Link></h2>
                    {course.description && <p className="course-description">{course.description}</p>}
                    <div className="course-meta">
                      <span>{course.instructor_name}</span>
                      {course.level && <span>{courseLevels[course.level]}</span>}
                      {course.price !== null && (
                        <strong>{formatCoursePrice(course.price)}</strong>
                      )}
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
