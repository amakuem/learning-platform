import type { ReactNode } from "react";
import type { InstructorCourse } from "../api/instructor";
import { AddResource, InlineResource } from "./InstructorInline";
import { lessonFields, moduleFields } from "./instructorFields";

type Module = InstructorCourse["modules"][number];

export default function InstructorOutlineModule({ module, renderLesson, showDescription = false }: {
  module: Module;
  renderLesson: (lesson: Module["lessons"][number]) => ReactNode;
  showDescription?: boolean;
}) {
  return (
    <>
      <InlineResource label={`модуль «${module.title}»`} path={`/modules/${module.id}`}
        fields={moduleFields(module)} confirmation="Удалить модуль и все его уроки?">
        <h3>{module.title}</h3>
      </InlineResource>
      {showDescription && module.description && <p>{module.description}</p>}
      <ul className="editable-lesson-list">
        {module.lessons.map((lesson) => (
          <li key={lesson.id}>
            <InlineResource label={`урок «${lesson.title}»`} path={`/lessons/${lesson.id}`}
              fields={lessonFields(lesson)} confirmation="Удалить урок, его материалы, тесты и прогресс студентов?">
              {renderLesson(lesson)}
            </InlineResource>
          </li>
        ))}
        <li className="editor-add-row">
          <AddResource label="Добавить урок" path={`/modules/${module.id}/lessons`} fields={lessonFields()} />
        </li>
      </ul>
    </>
  );
}
