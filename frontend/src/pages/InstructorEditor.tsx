import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { courseLevels, getCategories } from "../api/courses";
import type { InstructorCourse } from "../api/instructor";
import { useAuth } from "../context/AuthContext";
import { EditorAction, EditorForm } from "./InstructorForms";
import { titleField, descriptionField } from "./instructorFields";
import PageLayout from "./PageLayout";
import "./instructor.css";

function LoadState({ label, failed, retry }: { label: string; failed: boolean; retry: () => unknown }) {
  return failed ? (
    <div>
      <p role="alert">Не удалось загрузить {label}.</p>
      <button className="catalog-button" type="button" onClick={() => void retry()}>Повторить</button>
    </div>
  ) : <p role="status">Загружаем {label}…</p>;
}

function CourseForm({ course }: { course?: InstructorCourse }) {
  const navigate = useNavigate();
  const categories = useQuery({
    queryKey: ["course-categories"],
    queryFn: ({ signal }) => getCategories(signal),
    retry: false,
  });
  if (!categories.data) return <LoadState label="категории" failed={categories.isError} retry={categories.refetch} />;
  return (
    <EditorForm create={!course} path={course ? `/courses/${course.id}` : "/courses"}
      onSaved={course ? undefined : (id) => navigate(`/instructor/courses/${id}?edit=1`, { replace: true })}
      fields={[
        titleField(course?.title), descriptionField(course?.description),
        { name: "price", label: "Цена, BYN", kind: "number", min: 0, max: 99999999.99, step: "0.01", value: course?.price ?? 0 },
        { name: "level", label: "Уровень", kind: "select", value: course?.level ?? "beginner",
          choices: Object.entries(courseLevels).map(([value, label]) => ({ value, label })) },
        { name: "category_id", label: "Категория", kind: "select", value: course?.category_id,
          choices: categories.data.map(({ id, name }) => ({ value: id, label: name })) },
      ]}
    />
  );
}

export function CourseSettings({ course }: { course: InstructorCourse }) {
  const navigate = useNavigate();
  const path = `/courses/${course.id}`;
  return (
    <details className="editor-group course-settings">
      <summary>Настройки курса</summary>
      <div className="editor-group-content">
        <CourseForm key={course.id} course={course} />
        <div className="editor-toolbar">
          <EditorAction path={`${path}/${course.is_published ? "unpublish" : "publish"}`}
            label={course.is_published ? "Снять с публикации" : "Опубликовать"} />
          <EditorAction path={path} label="Удалить курс"
            confirmation="Удалить курс, его материалы и записи студентов?"
            onDone={() => navigate("/my-courses", { replace: true })} />
        </div>
      </div>
    </details>
  );
}

export default function InstructorEditor() {
  const { user } = useAuth();
  return (
    <PageLayout catalog>
      <div className="editor-toolbar"><Link className="catalog-button" to="/my-courses">← Мои курсы</Link></div>
      <div className="catalog-heading"><h1>Создать курс</h1></div>
      {user?.roles.includes("instructor")
        ? <section className="catalog-state"><CourseForm /></section>
        : <p className="catalog-state">Создавать курсы могут преподаватели.</p>}
    </PageLayout>
  );
}
