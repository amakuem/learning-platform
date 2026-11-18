import type { InstructorCourse, InstructorQuiz } from "../api/instructor";
import type { LessonPage } from "../api/learning";
import type { EditorField } from "./InstructorForms";

export const titleField = (value?: string): EditorField => ({
  name: "title", label: "Название", value, maxLength: 200,
});
export const descriptionField = (value?: string | null): EditorField => ({
  name: "description", label: "Описание", kind: "textarea", value, optional: true,
});
const order = (name: string, value?: number): EditorField => ({
  name, label: "Позиция", kind: "number", min: 1, value, optional: true,
});

type Module = InstructorCourse["modules"][number];
export const moduleFields = (module?: Module) => [
  titleField(module?.title), descriptionField(module?.description), order("order_in_course", module?.order),
];
export const lessonFields = (lesson?: Module["lessons"][number]): EditorField[] => [
  titleField(lesson?.title),
  { name: "duration", label: "Длительность", kind: "number", min: 0, value: lesson?.duration ?? 0 },
  order("order_in_module", lesson?.order),
];
export const pageFields = (page?: Pick<LessonPage, "title" | "order">) => [
  titleField(page?.title), order("order_in_lesson", page?.order),
];
export const sectionFields = (section?: LessonPage["sections"][number]): EditorField[] => [
  { name: "section_type", label: "Тип секции", kind: "select", value: section?.type ?? "text",
    choices: [{ value: "text", label: "Текст" }, { value: "code", label: "Код" }] },
  order("section_order", section?.order),
  { name: "content", label: "Содержимое", kind: "textarea", optional: true, value: section?.content },
  ...(section ? [{ name: "video_url", label: "Ссылка на видео", optional: true, value: section.video_url, maxLength: 500 }] : []),
];
export const quizFields = (quiz?: Pick<InstructorQuiz, "title" | "passing_score">): EditorField[] => [
  titleField(quiz?.title),
  { name: "passing_score", label: "Проходной балл (%)", kind: "number",
    min: 0, max: 100, value: quiz?.passing_score ?? 70 },
];
export const questionFields = (question?: InstructorQuiz["questions"][number]): EditorField[] => [
  { name: "text", label: "Текст вопроса", kind: "textarea", value: question?.text },
  { name: "points", label: "Баллы", kind: "number", min: 1, value: question?.points ?? 1 },
];


