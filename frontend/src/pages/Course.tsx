import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useParams } from "react-router-dom";
import { courseLevels, getCourse } from "../api/courses";
import CourseEnrollment from "./CourseEnrollment";
import PageLayout from "./PageLayout";
import { formatCoursePrice } from "./coursePrice";
import "./home.css";

export default function Course() {
  const { courseId } = useParams();
  const id = Number(courseId);
  const validId = /^\d+$/.test(courseId ?? "") && Number.isSafeInteger(id) && id > 0;
  const course = useQuery({
    queryKey: ["course", id],
    queryFn: ({ signal }) => getCourse(id, signal),
    enabled: validId,
    retry: false,
  });
  const data = course.data;
  const notFound = !validId || (isAxiosError(course.error) && course.error.response?.status === 404);

  return (
    <PageLayout catalog>
      <Link className="catalog-button course-back" to="/">
        <span aria-hidden="true">←</span> К каталогу
      </Link>
      {notFound ? (
        <h1 className="catalog-state">Курс не найден</h1>
      ) : data ? (
        <article className="course-detail">
          <header className="catalog-heading">
            <span className="course-category">{data.category_name}</span>
            <h1>{data.title}</h1>
            <div className="course-meta">
              {data.level && <span>{courseLevels[data.level]}</span>}
              <span>Записано студентов: {data.students}</span>
            </div>
          </header>
          <div className="course-detail-grid">
            <div className="course-detail-content">
              {data.description && <p className="course-detail-description">{data.description}</p>}
              <section className="catalog-state">
                <h2>Преподаватель</h2>
                <p>{data.instructor_name}</p>
                {data.instructor_bio && <p>{data.instructor_bio}</p>}
              </section>
              <section className="catalog-state">
                <h2>Программа курса</h2>
                {data.modules.length === 0 ? <p>Программа пока не добавлена.</p> : (
                  <ol className="course-modules">
                    {data.modules.map((module) => (
                      <li key={module.id}>
                        <h3>{module.title}</h3>
                        {module.description && <p>{module.description}</p>}
                        {module.lessons.length > 0 && (
                          <ul>
                            {module.lessons.map((lesson) => <li key={lesson.id}>{lesson.title}</li>)}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
            <aside className="catalog-state course-enrollment" aria-label="Запись на курс">
              {data.price !== null && <strong className="course-price">{formatCoursePrice(data.price)}</strong>}
              <CourseEnrollment courseId={id} />
            </aside>
          </div>
        </article>
      ) : course.isError ? (
        <div className="catalog-state">
          <p role="alert">Не удалось загрузить курс.</p>
          <button className="catalog-button" type="button" onClick={() => void course.refetch()}>Повторить</button>
        </div>
      ) : (
        <p className="catalog-state" role="status">Загружаем курс…</p>
      )}
    </PageLayout>
  );
}
