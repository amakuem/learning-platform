import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { submitQuiz, type LessonQuiz as Quiz } from "../api/learning";
import type { InstructorQuiz } from "../api/instructor";
import { AddResource, InlineResource } from "./InstructorInline";
import { questionFields, quizFields } from "./instructorFields";

export default function LessonQuiz({ quiz, userId, courseId, lessonId, preview = false, editorQuiz }: {
  quiz: Quiz;
  userId: number;
  courseId: number;
  lessonId: number;
  preview?: boolean;
  editorQuiz?: InstructorQuiz;
}) {
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [incomplete, setIncomplete] = useState(false);
  const queryClient = useQueryClient();
  const attempt = useMutation({
    mutationFn: () => submitQuiz(quiz.id, answers),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lesson-quizzes", userId, lessonId] }),
      queryClient.invalidateQueries({ queryKey: ["learning-course", userId, courseId] }),
      queryClient.invalidateQueries({ queryKey: ["my-enrollments", userId] }),
    ]),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || attempt.isPending) return;
    const missingAnswers = quiz.questions.some((question) => !answers[question.id]?.length);
    setIncomplete(missingAnswers);
    if (!missingAnswers) attempt.mutate();
  }

  const questions = quiz.questions.map((question, index) => {
    const selected = answers[question.id] ?? [];
    const result = attempt.data?.review.find((item) => item.question_id === question.id);
    const content = (
      <fieldset key={question.id} disabled={attempt.isPending}>
        <legend>{index + 1}. {question.text}</legend>
        {question.multiple && <p>Можно выбрать несколько ответов.</p>}
        {question.options.map((option) => (
          <label key={option.id}>
            <input
              type={question.multiple ? "checkbox" : "radio"}
              name={`question-${question.id}`}
              checked={selected.includes(option.id)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                const values = question.multiple
                  ? checked ? [...selected, option.id] : selected.filter((id) => id !== option.id)
                  : [option.id];
                setAnswers({ ...answers, [question.id]: values });
                attempt.reset();
                setIncomplete(false);
              }}
            />
            {option.text}
          </label>
        ))}
        {result && <p>{result.is_correct ? "Верно" : "Неверно"}</p>}
      </fieldset>
    );
    const editable = editorQuiz?.questions.find((item) => item.id === question.id);
    return editable ? (
      <InlineResource key={editable.id} label={`вопрос ${index + 1}`} path={`/questions/${editable.id}`}
        fields={questionFields(editable)} options={editable.options} confirmation="Удалить этот вопрос?">
        {content}
      </InlineResource>
    ) : content;
  });

  return (
    <section className="lesson-quiz">
      {editorQuiz ? (
        <InlineResource label={`тест «${quiz.title}»`} path={`/quizzes/${quiz.id}`} fields={quizFields(editorQuiz)}
          confirmation="Удалить тест, его вопросы и результаты попыток?">
          <h3>{quiz.title}</h3>
        </InlineResource>
      ) : <h3>{quiz.title}</h3>}
      <p>Проходной балл: {quiz.passing_score}%</p>
      {!preview && quiz.passed && !attempt.data?.is_passed && (
        <p className="quiz-result quiz-result-passed"><span aria-hidden="true">✓ </span>Тест уже пройден.</p>
      )}
      {editorQuiz ? (
        <div className="editor-quiz-questions">
          {questions.length === 0 && <p>Вопросы пока не добавлены.</p>}
          {questions}
          <AddResource label="Добавить вопрос" path={`/quizzes/${quiz.id}/questions`} fields={questionFields()} options={[]} />
        </div>
      ) : questions.length === 0 ? <p>Вопросы пока не добавлены.</p> : (
        <form onSubmit={submit}>
          {questions}
          {incomplete && <p className="login-error" role="alert">Ответьте на все вопросы.</p>}
          {attempt.isError && <p className="login-error" role="alert">Не удалось отправить ответы. Попробуйте ещё раз.</p>}
          {attempt.data && (
            <p className={attempt.data.is_passed ? "quiz-result quiz-result-passed" : "quiz-result"} role="status">
              {attempt.data.is_passed && <span aria-hidden="true">✓ </span>}
              {attempt.data.is_passed ? "Тест пройден" : "Тест пока не пройден"} · {attempt.data.score}% · {attempt.data.earned_points} из {attempt.data.total_points} баллов
            </p>
          )}
          {!preview && <button className="catalog-button catalog-apply" type="submit" disabled={attempt.isPending || Boolean(attempt.data)}>
            {attempt.isPending ? "Проверяем…" : "Проверить ответы"}
          </button>}
        </form>
      )}
    </section>
  );
}
