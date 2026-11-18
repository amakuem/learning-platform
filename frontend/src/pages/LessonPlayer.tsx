import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getLesson, getLessonQuizzes, viewLessonPage, type OutlineLesson } from "../api/learning";
import LessonQuiz from "./LessonQuiz";

interface Props {
  userId: number;
  courseId: number;
  lesson: OutlineLesson;
  requestedStep: number;
  nextLesson?: OutlineLesson;
  selectStep: (step: number) => void;
}

function videoSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export default function LessonPlayer({ userId, courseId, lesson, requestedStep, nextLesson, selectStep }: Props) {
  const queryClient = useQueryClient();
  const courseKey = ["learning-course", userId, courseId];
  const materialKey = ["lesson-material", userId, lesson.id];
  const material = useQuery({
    queryKey: materialKey,
    queryFn: ({ signal }) => getLesson(lesson.id, signal),
    retry: false,
  });
  const quiz = useQuery({
    queryKey: ["lesson-quizzes", userId, lesson.id],
    queryFn: ({ signal }) => getLessonQuizzes(lesson.id, signal),
    retry: false,
  });
  const pages = material.data?.pages;
  const quizzes = quiz.data;
  const stepCount = Math.max(1, (pages?.length ?? 0) + (quizzes?.length ?? 0));
  const step = Number.isInteger(requestedStep) && requestedStep > 0 ? Math.min(requestedStep, stepCount) : 1;
  const page = pages?.[step - 1];
  const pageId = pages && quizzes ? page?.id : undefined;
  const viewed = material.data?.viewed_page_ids;
  const alreadyViewed = pageId !== undefined && viewed?.includes(pageId);
  const view = useMutation({
    mutationFn: (id: number) => viewLessonPage(lesson.id, id),
    onSuccess: async (_, id) => {
      await queryClient.cancelQueries({ queryKey: materialKey });
      queryClient.setQueryData<Awaited<ReturnType<typeof getLesson>>>(materialKey, (current) =>
        current && !current.viewed_page_ids.includes(id)
          ? { ...current, viewed_page_ids: [...current.viewed_page_ids, id] }
          : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKey }),
        queryClient.invalidateQueries({ queryKey: ["my-enrollments", userId] }),
      ]);
    },
  });
  const markViewed = view.mutate;

  useEffect(() => {
    if (pageId !== undefined && !alreadyViewed) markViewed(pageId);
  }, [pageId, alreadyViewed, markViewed]);

  if (material.isError || quiz.isError) {
    return (
      <div className="catalog-state">
        <p role="alert">Не удалось загрузить урок.</p>
        <button type="button" className="catalog-button" onClick={() => {
          if (material.isError) void material.refetch();
          if (quiz.isError) void quiz.refetch();
        }}>Повторить</button>
      </div>
    );
  }

  if (!material.data || quiz.isPending) return <p className="catalog-state" role="status">Загружаем урок…</p>;

  const materialPages = material.data.pages;
  const tests = quizzes ?? [];
  const activeQuiz = tests[step - materialPages.length - 1];

  return (
    <article className="catalog-state lesson-player" aria-labelledby="lesson-title">
      <h2 id="lesson-title">{lesson.title}</h2>
      <nav className="lesson-steps" aria-label="Шаги урока">
        {Array.from({ length: stepCount }, (_, index) => {
          const pageAtStep = materialPages[index];
          const testAtStep = tests[index - materialPages.length];
          const done = pageAtStep
            ? viewed?.includes(pageAtStep.id) || (view.isPending && view.variables === pageAtStep.id)
            : testAtStep?.passed;
          return (
            <button
              className={done ? "catalog-button lesson-step-done" : "catalog-button"}
              key={index}
              type="button"
              aria-current={step === index + 1 ? "step" : undefined}
              aria-label={`Шаг ${index + 1}${testAtStep ? ". Тест" : ""}${done ? ". Пройден" : ""}`}
              onClick={() => selectStep(index + 1)}
            >{index + 1}</button>
          );
        })}
      </nav>
      <p className="lesson-step-count" role="status">Шаг {step} из {stepCount}{activeQuiz && " · Тест"}</p>
      {page && (
        <section className="lesson-material" key={page.id}>
          <h3>{page.title}</h3>
          {page.sections.length === 0 && <p>На этой странице пока нет материалов.</p>}
          {page.sections.map((section) => {
            const video = videoSource(section.video_url);
            return (
              <div key={section.id}>
                {section.content && (section.type === "code"
                  ? <pre><code>{section.content}</code></pre>
                  : <p className="lesson-text">{section.content}</p>)}
                {video && (
                  /\.(mp4|webm|ogv)$/i.test(video.pathname)
                    ? <video controls preload="metadata" src={video.href} />
                    : <a href={video.href} target="_blank" rel="noreferrer">Открыть видео</a>
                )}
              </div>
            );
          })}
        </section>
      )}
      {tests.map((test) => (
        <div key={test.id} hidden={activeQuiz?.id !== test.id}>
          <LessonQuiz quiz={test} userId={userId} courseId={courseId} lessonId={lesson.id} />
        </div>
      ))}
      {!page && !activeQuiz && <p>В уроке пока нет материалов.</p>}
      {view.isError && view.variables === pageId && (
        <div>
          <p className="login-error" role="alert">Не удалось отметить страницу просмотренной.</p>
          <button type="button" className="catalog-button" onClick={() => pageId !== undefined && markViewed(pageId)}>Повторить</button>
        </div>
      )}
      <footer className="lesson-controls">
        <button className="catalog-button" type="button" disabled={step === 1} onClick={() => selectStep(step - 1)}>← Назад</button>
        {step < stepCount ? (
          <button className="catalog-button catalog-apply" type="button" onClick={() => selectStep(step + 1)}>Далее →</button>
        ) : nextLesson ? (
          <Link className="catalog-button catalog-apply" to={`?lesson=${nextLesson.id}&step=1`}>Следующий урок →</Link>
        ) : (
          <Link className="catalog-button" to="/my-courses">Мои курсы</Link>
        )}
      </footer>
    </article>
  );
}
