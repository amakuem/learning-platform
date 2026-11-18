import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getLearningCourse } from "../api/learning";
import { getInstructorCourse } from "../api/instructor";
import { useAuth } from "../context/AuthContext";
import LessonPlayer from "./LessonPlayer";
import LessonDiscussion from "./LessonDiscussion";
import { AddResource } from "./InstructorInline";
import InstructorOutlineModule from "./InstructorOutline";
import { moduleFields } from "./instructorFields";
import PageLayout from "./PageLayout";
import "./home.css";
import "./learning.css";

const lessonStatuses = {
  not_started: "Не начат",
  in_progress: "В процессе",
  completed: "Пройден",
};

export default function Learning({ instructorPreview = false }: { instructorPreview?: boolean }) {
  const { courseId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const id = Number(courseId);
  const validId = /^\d+$/.test(courseId ?? "") && Number.isSafeInteger(id) && id > 0;
  const canOpen = Boolean(user?.roles.includes(instructorPreview ? "instructor" : "student"));
  const learning = useQuery({
    queryKey: ["learning-course", user?.id, id],
    queryFn: ({ signal }) => getLearningCourse(id, signal),
    enabled: !instructorPreview && canOpen && validId,
    retry: false,
  });
  const authored = useQuery({
    queryKey: ["instructor-editor", user?.id, "course", id],
    queryFn: ({ signal }) => getInstructorCourse(id, signal),
    enabled: instructorPreview && canOpen && validId,
    retry: false,
  });
  const course = instructorPreview ? authored : learning;
  const editing = instructorPreview && search.get("edit") === "1";
  const data = authored.data && instructorPreview ? {
    ...authored.data,
    modules: authored.data.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, progress_status: "not_started" as const })),
    })),
  } : learning.data;
  const lessons = data?.modules.flatMap((module) => module.lessons) ?? [];
  const selected = lessons.find((lesson) => lesson.id === Number(search.get("lesson"))) ??
    lessons.find((lesson) => lesson.progress_status !== "completed") ?? lessons[0];
  const nextLesson = selected ? lessons[lessons.indexOf(selected) + 1] : undefined;
  const completed = lessons.filter((lesson) => lesson.progress_status === "completed").length;
  const accessDenied = !canOpen || (isAxiosError(course.error) && course.error.response?.status === 403);
  const selectedId = selected?.id;
  const requestedLesson = search.get("lesson");
  const requestedStep = search.get("step");
  const instructorPath = `/instructor/courses/${id}`;

  function stepLocation(lessonId: number, step: number | string) {
    return { lesson: String(lessonId), step: String(step), ...(editing ? { edit: "1" } : {}) };
  }

  useEffect(() => {
    if (selectedId !== undefined && requestedLesson !== String(selectedId)) {
      setSearch({
        lesson: String(selectedId), step: requestedLesson ? "1" : requestedStep ?? "1",
        ...(editing ? { edit: "1" } : {}),
      }, { replace: true });
    }
  }, [selectedId, requestedLesson, requestedStep, editing, setSearch]);

  return (
    <PageLayout catalog>
      {instructorPreview && data && (
        <>
          <Link className="catalog-button course-back" to={`${instructorPath}${editing ? "?edit=1" : ""}`}>← К курсу</Link>
          <button className="catalog-button catalog-apply course-back instructor-toggle" type="button"
            onClick={() => setSearch((current) => {
              const next = new URLSearchParams(current);
              if (editing) next.delete("edit");
              else next.set("edit", "1");
              return next;
            })}>
            {editing ? "Выйти из режима редактирования" : "Редактировать"}
          </button>
        </>
      )}
      <div className="catalog-heading"><h1>{data?.title ?? "Обучение"}</h1></div>
      {!validId ? (
        <p className="catalog-state">Курс не найден.</p>
      ) : accessDenied ? (
        <p className="catalog-state">{instructorPreview ? "Предпросмотр доступен автору курса." : "Обучение доступно студентам, записанным на курс."}</p>
      ) : course.isError ? (
        <div className="catalog-state">
          <p role="alert">Не удалось загрузить программу курса.</p>
          <button className="catalog-button" onClick={() => void course.refetch()}>Повторить</button>
        </div>
      ) : !data ? (
        <p className="catalog-state" role="status">Загружаем курс…</p>
      ) : !user || (!selected && !editing) ? (
        <p className="catalog-state">В этом курсе пока нет уроков.</p>
      ) : (
        <div className="learning-layout">
          <aside className="catalog-state learning-outline">
            <h2>Содержание курса</h2>
            {!instructorPreview && <label className="learning-progress">
              Пройдено уроков: {completed} из {lessons.length}
              <progress value={completed} max={lessons.length} />
            </label>}
            <nav aria-label="Уроки курса">
              {editing && authored.data ? (
                <>
                  {authored.data.modules.map((module) => (
                    <section key={module.id}>
                      <InstructorOutlineModule module={module} renderLesson={(lesson) => (
                        <Link to={{ search: new URLSearchParams(stepLocation(lesson.id, 1)).toString() }}
                          aria-current={selected?.id === lesson.id ? "page" : undefined}>{lesson.title}</Link>
                      )} />
                    </section>
                  ))}
                  <AddResource label="Добавить модуль" path={`/courses/${id}/modules`} fields={moduleFields()} />
                </>
              ) : data.modules.map((module) => (
                <section key={module.id}>
                  <h3>{module.title}</h3>
                  {module.lessons.length === 0 ? <p>Пока нет уроков.</p> : (
                    <ul>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <Link to={`?lesson=${lesson.id}&step=1`} aria-current={selected?.id === lesson.id ? "page" : undefined}>
                            {lesson.title}
                            {!instructorPreview && <span className="lesson-status" data-status={lesson.progress_status}>
                              {lessonStatuses[lesson.progress_status]}
                            </span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </nav>
          </aside>
          {selected ? <div className="learning-content" key={`${user.id}:${selected.id}`}>
            <LessonPlayer
              userId={user.id}
              preview={instructorPreview}
              editing={editing}
              courseId={id}
              lesson={selected}
              requestedStep={Number(search.get("step"))}
              nextLesson={nextLesson}
              selectStep={(step) => setSearch(stepLocation(selected.id, step))}
            />
            <LessonDiscussion lessonId={selected.id} userId={user.id} />
          </div> : <p className="catalog-state">Выберите или добавьте урок в содержании курса.</p>}
        </div>
      )}
    </PageLayout>
  );
}
