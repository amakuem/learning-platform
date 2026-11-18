import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getLearningCourse } from "../api/learning";
import { useAuth } from "../context/AuthContext";
import LessonPlayer from "./LessonPlayer";
import LessonDiscussion from "./LessonDiscussion";
import PageLayout from "./PageLayout";
import "./home.css";
import "./learning.css";

const lessonStatuses = {
  not_started: "Не начат",
  in_progress: "В процессе",
  completed: "Пройден",
};

export default function Learning() {
  const { courseId } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const id = Number(courseId);
  const validId = /^\d+$/.test(courseId ?? "") && Number.isSafeInteger(id) && id > 0;
  const isStudent = Boolean(user?.roles.includes("student"));
  const course = useQuery({
    queryKey: ["learning-course", user?.id, id],
    queryFn: ({ signal }) => getLearningCourse(id, signal),
    enabled: isStudent && validId,
    retry: false,
  });
  const data = course.data;
  const lessons = data?.modules.flatMap((module) => module.lessons) ?? [];
  const selected = lessons.find((lesson) => lesson.id === Number(search.get("lesson"))) ??
    lessons.find((lesson) => lesson.progress_status !== "completed") ?? lessons[0];
  const nextLesson = selected ? lessons[lessons.indexOf(selected) + 1] : undefined;
  const completed = lessons.filter((lesson) => lesson.progress_status === "completed").length;
  const accessDenied = !isStudent || (isAxiosError(course.error) && course.error.response?.status === 403);
  const selectedId = selected?.id;
  const requestedLesson = search.get("lesson");
  const requestedStep = search.get("step");

  useEffect(() => {
    if (selectedId !== undefined && requestedLesson !== String(selectedId)) {
      setSearch({ lesson: String(selectedId), step: requestedStep ?? "1" }, { replace: true });
    }
  }, [selectedId, requestedLesson, requestedStep, setSearch]);

  return (
    <PageLayout catalog>
      <div className="catalog-heading"><h1>{data?.title ?? "Обучение"}</h1></div>
      {!validId ? (
        <p className="catalog-state">Курс не найден.</p>
      ) : accessDenied ? (
        <p className="catalog-state">Обучение доступно студентам, записанным на курс.</p>
      ) : course.isError ? (
        <div className="catalog-state">
          <p role="alert">Не удалось загрузить программу курса.</p>
          <button className="catalog-button" onClick={() => void course.refetch()}>Повторить</button>
        </div>
      ) : !data ? (
        <p className="catalog-state" role="status">Загружаем курс…</p>
      ) : !selected || !user ? (
        <p className="catalog-state">В этом курсе пока нет уроков.</p>
      ) : (
        <div className="learning-layout">
          <aside className="catalog-state learning-outline">
            <h2>Содержание курса</h2>
            <label className="learning-progress">
              Пройдено уроков: {completed} из {lessons.length}
              <progress value={completed} max={lessons.length} />
            </label>
            <nav aria-label="Уроки курса">
              {data.modules.map((module) => (
                <section key={module.id}>
                  <h3>{module.title}</h3>
                  {module.lessons.length === 0 ? <p>Пока нет уроков.</p> : (
                    <ul>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <Link to={`?lesson=${lesson.id}&step=1`} aria-current={selected.id === lesson.id ? "page" : undefined}>
                            {lesson.title}
                            <span className="lesson-status" data-status={lesson.progress_status}>
                              {lessonStatuses[lesson.progress_status]}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </nav>
          </aside>
          <div className="learning-content" key={`${user.id}:${selected.id}`}>
            <LessonPlayer
              userId={user.id}
              courseId={id}
              lesson={selected}
              requestedStep={Number(search.get("step"))}
              nextLesson={nextLesson}
              selectStep={(step) => setSearch({ lesson: String(selected.id), step: String(step) })}
            />
            <LessonDiscussion lessonId={selected.id} userId={user.id} />
          </div>
        </div>
      )}
    </PageLayout>
  );
}
