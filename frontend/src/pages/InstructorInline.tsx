import { useState, type ReactNode } from "react";
import type { QuizOption } from "../api/instructor";
import { EditorAction, EditorForm, type EditorField } from "./InstructorForms";
import "./instructor.css";

export function InlineResource({ children, path, fields, label, confirmation, options, onSaved }: {
  children: ReactNode;
  path: string;
  fields: EditorField[];
  label: string;
  confirmation: string;
  options?: QuizOption[];
  onSaved?: (id: number) => void;
}) {
  const [action, setAction] = useState<"edit" | "delete" | null>(null);
  return (
    <div className="inline-resource">
      <div className="inline-resource-content">{children}</div>
      <div className="inline-resource-tools">
        <button type="button" className="catalog-button" title={`Редактировать ${label}`}
          aria-label={`Редактировать ${label}`} aria-expanded={action === "edit"}
          onClick={() => setAction(action === "edit" ? null : "edit")}>✎</button>
        <button type="button" className="catalog-button catalog-danger" title={`Удалить ${label}`}
          aria-label={`Удалить ${label}`} aria-expanded={action === "delete"}
          onClick={() => setAction(action === "delete" ? null : "delete")}>×</button>
      </div>
      {action && (
        <div className="inline-resource-panel">
          {action === "edit" ? (
            <>
              <EditorForm path={path} fields={fields} options={options} onSaved={(id) => {
                setAction(null);
                onSaved?.(id);
              }} />
              <button type="button" className="catalog-button" onClick={() => setAction(null)}>Закрыть</button>
            </>
          ) : <EditorAction path={path} label={`Удалить ${label}`} confirmation={confirmation}
            onCancel={() => setAction(null)} onDone={() => setAction(null)} />}
        </div>
      )}
    </div>
  );
}

export function AddResource({ label, path, fields, options, onSaved }: {
  label: string;
  path: string;
  fields: EditorField[];
  options?: QuizOption[];
  onSaved?: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-add">
      <button type="button" className="catalog-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Отмена" : `+ ${label}`}
      </button>
      {open && (
        <div className="inline-resource-panel">
          <EditorForm create path={path} fields={fields} options={options} onSaved={(id) => {
            setOpen(false);
            onSaved?.(id);
          }} />
        </div>
      )}
    </div>
  );
}

