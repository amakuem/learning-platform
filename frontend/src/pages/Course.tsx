import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { courseLevels, getCourse } from "../api/courses";
import { getInstructorCourse } from "../api/instructor";
import { useAuth } from "../context/AuthContext";
import CourseEnrollment from "./CourseEnrollment";
import { CourseSettings } from "./InstructorEditor";
import { AddResource } from "./InstructorInline";
import InstructorOutlineModule from "./InstructorOutline";
import { moduleFields } from "./instructorFields";
import PageLayout from "./PageLayout";
import { formatCoursePrice } from "./coursePrice";
import "./home.css";

export default function Course({ instructorPreview = false, defaultEditing = false }: {
  instructorPreview?: boolean;
  defaultEditing?: boolean;
}) {
  const { courseId } = useParams();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const id = Number(courseId);
  const validId = /^\d+$/.test(courseId ?? "") && Number.isSafeInteger(id) && id > 0;
  const publicCourse = useQuery({
    queryKey: ["course", id],
    queryFn: ({ signal }) => getCourse(id, signal),
    enabled: validId && !instructorPreview,
    retry: false,
  });
  const authoredCourse = useQuery({
    queryKey: ["instructor-editor", user?.id, "course", id],
    queryFn: ({ signal }) => getInstructorCourse(id, signal),
    enabled: validId && instructorPreview,
    retry: false,
  });
  const course = instructorPreview ? authoredCourse : publicCourse;
  const data = course.data;
  const instructorPath = `/instructor/courses/${id}`;
  const ownCourse = instructorPreview ? authoredCourse.data : undefined;
  const editing = Boolean(ownCourse && (defaultEditing || search.get("edit") === "1"));
  const notFound = !validId || (isAxiosError(course.error) && course.error.response?.status === 404);

  return (
    <PageLayout catalog>
      <Link className="catalog-button course-back" to={instructorPreview ? "/my-courses" : "/"}>
        <span aria-hidden="true">←</span> {instructorPreview ? "Мои курсы" : "К каталогу"}
      </Link>
      {ownCourse && (
        <Link className="catalog-button catalog-apply course-back instructor-toggle"
          to={editing ? instructorPath : `${instructorPath}?edit=1`}>
          {editing ? "Выйти из режима редактирования" : "Редактировать"}
        </Link>
      )}
      {notFound ? (
        <h1 className="catalog-state">Курс не найден</h1>
      ) : data ? (
        <article className="course-detail">
          <header className="catalog-heading course-overview">
            <span className="course-category">{data.category_name}</span>
            <h1>{data.title}</h1>
            {data.description && <p className="course-detail-description">{data.description}</p>}
            <div className="course-meta">
              {data.level && <span>{courseLevels[data.level]}</span>}
              <span>Записано студентов: {data.students}</span>
            </div>
          </header>
          {editing && ownCourse && <CourseSettings course={ownCourse} />}
          <div className="course-detail-grid">
            <div className="course-detail-content">
              <section className="catalog-state">
                <h2>Преподаватель</h2>
                <p>{data.instructor_name}</p>
                {data.instructor_bio && <p>{data.instructor_bio}</p>}
              </section>
              <section className="catalog-state">
                <h2>Программа курса</h2>
                {editing && ownCourse ? (
                  <ol className="course-modules">
                    {ownCourse.modules.map((module) => (
                      <li key={module.id}>
                        <InstructorOutlineModule module={module} showDescription renderLesson={(lesson) => (
                          <Link to={`${instructorPath}/preview?lesson=${lesson.id}&step=1&edit=1`}>{lesson.title}</Link>
                        )} />
                      </li>
                    ))}
                    <li className="editor-add-row">
                      <AddResource label="Добавить модуль" path={`/courses/${id}/modules`} fields={moduleFields()} />
                    </li>
                  </ol>
                ) : data.modules.length === 0 ? <p>Программа пока не добавлена.</p> : (
                  <ol className="course-modules">
                    {data.modules.map((module) => (
                      <li key={module.id}>
                        <h3>{module.title}</h3>
                        {module.description && <p>{module.description}</p>}
                        {module.lessons.length > 0 && (
                          <ul>
                            {module.lessons.map((lesson) => (
                              <li key={lesson.id}>
                                {instructorPreview
                                  ? <Link to={`${instructorPath}/preview?lesson=${lesson.id}`}>{lesson.title}</Link>
                                  : lesson.title}
                              </li>
                            ))}
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
              {ownCourse
                ? <p>{ownCourse.is_published ? "Опубликован" : "Черновик"}</p>
                : <CourseEnrollment courseId={id} />}
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
