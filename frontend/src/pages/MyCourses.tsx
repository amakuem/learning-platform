import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getInstructorCourses, getMyEnrollments } from "../api/courses";
import { useAuth } from "../context/AuthContext";
import PageLayout from "./PageLayout";
import "./home.css";

interface CourseListProps {
  heading: string;
  emptyMessage: string;
  items?: { id: number; title: string; status?: string }[];
  isError: boolean;
  learning?: boolean;
  refetch: () => unknown;
}

function CourseList({ heading, emptyMessage, items, isError, learning, refetch }: CourseListProps) {
  return (
    <section className="my-courses-section" aria-label={heading}>
      <h2>{heading}</h2>
      {isError && (
        <div className="catalog-state">
          <p role="alert">Не удалось загрузить курсы.</p>
          <button className="catalog-button" type="button" onClick={() => void refetch()}>Повторить</button>
        </div>
      )}
      {!items && !isError && <p className="catalog-state" role="status">Загружаем курсы…</p>}
      {items?.length === 0 && <p className="catalog-state">{emptyMessage}</p>}
      {items && items.length > 0 && (
        <ul className="course-grid">
          {items.map(({ id, title, status }) => (
            <li className="course-card" key={id}>
              <h3>{learning ? <Link className="course-card-link" to={`/learn/${id}`}>{title}</Link> : title}</h3>
              {status && <span className="course-category">{status}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MyCourses() {
  const { user } = useAuth();
  const isStudent = Boolean(user?.roles.includes("student"));
  const isInstructor = Boolean(user?.roles.includes("instructor"));
  const studentCourses = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: ({ signal }) => getMyEnrollments(signal),
    enabled: isStudent,
    retry: false,
  });
  const instructorCourses = useQuery({
    queryKey: ["instructor-courses", user?.id],
    queryFn: ({ signal }) => getInstructorCourses(signal),
    enabled: isInstructor,
    retry: false,
  });

  return (
    <PageLayout catalog>
      <div className="catalog-heading"><h1>Мои курсы</h1></div>
      {isStudent && (
        <CourseList
          learning
          heading="Курсы, на которые вы записаны"
          emptyMessage="Вы пока не записаны ни на один курс."
          items={studentCourses.data?.map(({ course_id, title }) => ({ id: course_id, title }))}
          isError={studentCourses.isError}
          refetch={studentCourses.refetch}
        />
      )}
      {isInstructor && (
        <CourseList
          heading="Ваши курсы"
          emptyMessage="У вас пока нет созданных курсов."
          items={instructorCourses.data?.map(({ id, title, is_published }) => ({
            id,
            title,
            status: is_published ? "Опубликован" : "Черновик",
          }))}
          isError={instructorCourses.isError}
          refetch={instructorCourses.refetch}
        />
      )}
      {!isStudent && !isInstructor && (
        <p className="catalog-state">Раздел доступен студентам и преподавателям.</p>
      )}
    </PageLayout>
  );
}
