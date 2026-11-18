import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { saveInstructorResource, type QuizOption } from "../api/instructor";

export interface EditorField {
  name: string;
  label: string;
  value?: string | number | null;
  kind?: "number" | "textarea" | "select";
  optional?: boolean;
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
  choices?: { value: string | number; label: string }[];
}

function requestError(error: unknown) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (error.response?.status === 422) return "Проверьте введённые данные.";
  }
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

function useEditorMutation() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ method, path, data }: {
      method: "post" | "patch" | "delete";
      path: string;
      data?: Record<string, unknown>;
    }) => saveInstructorResource(method, path, data),
    onSuccess: () => Promise.all([
      cache.invalidateQueries({ queryKey: ["instructor-editor"] }),
      cache.invalidateQueries({ queryKey: ["instructor-courses"] }),
      cache.invalidateQueries({ queryKey: ["courses"] }),
      cache.invalidateQueries({ queryKey: ["course"] }),
      cache.invalidateQueries({ queryKey: ["learning-course"] }),
      cache.invalidateQueries({ queryKey: ["lesson-material"] }),
      cache.invalidateQueries({ queryKey: ["lesson-quizzes"] }),
    ]),
  });
}

function EditorInput({ field }: { field: EditorField }) {
  const props = {
    className: "login-input",
    name: field.name,
    defaultValue: field.value ?? "",
    required: !field.optional,
  };
  return (
    <label className="login-field">
      {field.label}
      {field.kind === "textarea" ? <textarea {...props} rows={3} maxLength={field.maxLength} />
        : field.kind === "select" ? (
          <select {...props}>
            <option value="" disabled>Выберите значение</option>
            {field.choices?.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        ) : (
          <input {...props} type={field.kind ?? "text"} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} />
        )}
    </label>
  );
}

const emptyOption = { text: "", is_correct: false };

export function EditorForm({ fields, path, create = false, options, onSaved }: {
  fields: EditorField[];
  path: string;
  create?: boolean;
  options?: QuizOption[];
  onSaved?: (id: number) => void;
}) {
  const mutation = useEditorMutation();
  const [validation, setValidation] = useState("");
  const [answers, setAnswers] = useState(() => (options?.length ?? 0) >= 2
    ? options!
    : [...(options ?? []), ...Array.from({ length: 2 - (options?.length ?? 0) }, () => emptyOption)]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    setValidation("");
    mutation.reset();
    const form = event.currentTarget;
    const values = new FormData(form);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = String(values.get(field.name) ?? "");
      const value = raw.trim();
      if (!value && !field.optional) {
        setValidation(`Заполните поле «${field.label}».`);
        return;
      }
      if (field.kind === "number" && !value) continue;
      data[field.name] = field.kind === "number" ? Number(value) : value ? (field.kind === "textarea" ? raw : value) : null;
    }
    if (options) {
      if (!answers.some((answer) => answer.is_correct) || answers.some((answer) => !answer.text.trim())) {
        setValidation("Заполните варианты ответа и отметьте хотя бы один правильный.");
        return;
      }
      data.options = answers.map((answer) => ({ ...answer, text: answer.text.trim() }));
    }
    try {
      const saved = await mutation.mutateAsync({ method: create ? "post" : "patch", path, data });
      if (create) {
        form.reset();
        setAnswers([emptyOption, emptyOption]);
      }
      onSaved?.(saved.id);
    } catch {
      // Текст ошибки отображается под формой.
    }
  }

  return (
    <form className="editor-form" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={mutation.isPending}>
        <div className="editor-fields">
          {fields.map((field) => <EditorInput key={field.name} field={field} />)}
        </div>
        {options && (
          <fieldset className="editor-options">
            <legend>Варианты ответа</legend>
            {answers.map((answer, index) => (
              <div className="editor-option" key={index}>
                <label className="login-field">
                  Вариант {index + 1}
                  <input className="login-input" value={answer.text} required onChange={(event) => {
                    const text = event.target.value;
                    setAnswers((current) => current.map((item, position) => position === index ? { ...item, text } : item));
                  }} />
                </label>
                <label className="editor-correct">
                  <input type="checkbox" checked={answer.is_correct} onChange={(event) => {
                    const isCorrect = event.target.checked;
                    setAnswers((current) => current.map((item, position) => position === index ? { ...item, is_correct: isCorrect } : item));
                  }} /> Правильный
                </label>
                <button className="catalog-button catalog-danger" type="button" disabled={answers.length <= 2}
                  aria-label={`Удалить вариант ${index + 1}`}
                  onClick={() => setAnswers((current) => current.filter((_, position) => position !== index))}>Удалить</button>
              </div>
            ))}
            <button className="catalog-button" type="button" onClick={() => setAnswers((current) => [...current, emptyOption])}>
              Добавить вариант
            </button>
          </fieldset>
        )}
        <button type="submit" className="catalog-button catalog-apply">
          {mutation.isPending ? "Сохраняем…" : create ? "Добавить" : "Сохранить"}
        </button>
      </fieldset>
      {(validation || mutation.isError) && <p className="login-error" role="alert">{validation || requestError(mutation.error)}</p>}
      {mutation.isSuccess && !validation && <p role="status">Сохранено.</p>}
    </form>
  );
}

export function EditorAction({ path, label, confirmation, onDone, onCancel }: {
  path: string;
  label: string;
  confirmation?: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [confirming, setConfirming] = useState(Boolean(onCancel));
  const mutation = useEditorMutation();
  const danger = Boolean(confirmation);

  async function run() {
    try {
      await mutation.mutateAsync({ path, method: danger ? "delete" : "post" });
      setConfirming(false);
      onDone?.();
    } catch {
      // Текст ошибки отображается под кнопкой.
    }
  }

  return (
    <div className="editor-action">
      {confirming && <p>{confirmation}</p>}
      <div className="editor-actions">
        <button type="button" className={danger ? "catalog-button catalog-danger" : "catalog-button"}
          disabled={mutation.isPending}
          onClick={() => danger && !confirming ? setConfirming(true) : void run()}>
          {mutation.isPending ? "Выполняем…" : confirming ? "Подтвердить удаление" : label}
        </button>
        {confirming && <button type="button" className="catalog-button" disabled={mutation.isPending}
          onClick={() => onCancel ? onCancel() : setConfirming(false)}>Отмена</button>}
      </div>
      {mutation.isError && <p className="login-error" role="alert">{requestError(mutation.error)}</p>}
    </div>
  );
}
