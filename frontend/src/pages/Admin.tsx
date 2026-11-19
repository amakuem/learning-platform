import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  deleteAdminDiscussion, getAdminDiscussions, getAdminLogs, getAdminLogOptions, getAdminRoles,
  getAdminUser, getAdminUsers, saveAdminUser, type AdminFilters,
} from "../api/admin";
import { useAuth } from "../context/AuthContext";
import PageLayout from "./PageLayout";
import "./home.css";
import "./admin.css";

const roleNames: Record<string, string> = { student: "Студент", instructor: "Преподаватель", admin: "Администратор" };
const dateFormat = new Intl.DateTimeFormat("ru-BY", { dateStyle: "medium", timeStyle: "short" });
const date = (value: string | null) => value ? dateFormat.format(new Date(value)) : "—";
function errorText(error: unknown) {
  const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
  return typeof detail === "string" ? detail : "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export default function Admin() {
  const { user } = useAuth();
  return (
    <PageLayout catalog>
      <div className="catalog-heading"><h1>Админ-панель</h1></div>
      {user?.roles.includes("admin") ? (
        <>
          <nav className="admin-tabs" aria-label="Разделы админ-панели">
            <NavLink to="/admin/users">Пользователи</NavLink>
            <NavLink to="/admin/logs">Журнал активности</NavLink>
            <NavLink to="/admin/discussions">Обсуждения</NavLink>
          </nav>
          <Outlet />
        </>
      ) : <p className="catalog-state">Раздел доступен администраторам.</p>}
    </PageLayout>
  );
}

function Filters({ children, apply }: { children: ReactNode; apply: (filters: AdminFilters) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: AdminFilters = {};
    for (const [key, raw] of new FormData(event.currentTarget)) {
      const value = String(raw).trim();
      if (value) values[key] = key === "start" || key === "end" ? new Date(value).toISOString() : value;
    }
    apply(values);
  }
  return (
    <form className="admin-filters" onSubmit={submit} onReset={() => apply({})}>
      {children}
      <div className="admin-actions">
        <button className="catalog-button catalog-apply" type="submit">Применить</button>
        <button className="catalog-button" type="reset">Сбросить</button>
      </div>
    </form>
  );
}

function Results({ pending, error, retry, length, page, setPage, children }: {
  pending: boolean; error: unknown; retry: () => unknown; length?: number;
  page: number; setPage: (page: number) => void; children: ReactNode;
}) {
  return (
    <>
      {pending && <p role="status">Загружаем…</p>}
      {Boolean(error) && <div><p className="login-error" role="alert">{errorText(error)}</p>
        <button className="catalog-button" type="button" onClick={() => void retry()}>Повторить</button></div>}
      {length === 0 && <p className="catalog-state">По выбранным параметрам записей нет.</p>}
      {children}
      {length !== undefined && (page > 0 || length === 50) && (
        <nav className="catalog-pagination" aria-label="Страницы результатов">
          <button className="catalog-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
          <span>Страница {page + 1}</span>
          <button className="catalog-button" disabled={length < 50} onClick={() => setPage(page + 1)}>Далее</button>
        </nav>
      )}
    </>
  );
}

function UserEditor({ id, close }: { id: number; close: () => void }) {
  const [validationError, setValidationError] = useState("");
  const { user, syncUser } = useAuth();
  const cache = useQueryClient();
  const profile = useQuery({ queryKey: ["admin-user", user?.id, id], queryFn: ({ signal }) => getAdminUser(id, signal), retry: false });
  const roles = useQuery({ queryKey: ["admin-roles", user?.id], queryFn: ({ signal }) => getAdminRoles(signal), retry: false });
  const save = useMutation({
    mutationFn: (data: { roles: string[]; is_active: boolean }) => saveAdminUser(id, data),
    onSuccess: async (updated) => {
      if (updated.id === user?.id) syncUser(updated);
      cache.setQueryData(["profile", id], updated);
      await cache.invalidateQueries({ queryKey: ["admin-users"] });
      close();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const form = new FormData(event.currentTarget);
    const selectedRoles = form.getAll("roles").map(String);
    save.reset();
    if (selectedRoles.length !== 1) {
      setValidationError("Выберите одну роль пользователя.");
      return;
    }
    setValidationError("");
    save.mutate({ roles: selectedRoles, is_active: form.get("active") === "true" });
  }
  const data = profile.data;
  return (
    <section className="catalog-state admin-user-editor" aria-label="Карточка пользователя">
      <div className="admin-actions"><h2>Пользователь</h2><button className="catalog-button" onClick={close}>Закрыть</button></div>
      {(profile.isPending || roles.isPending) && <p role="status">Загружаем…</p>}
      {(profile.isError || roles.isError) && <div>
        <p className="login-error" role="alert">Не удалось загрузить карточку.</p>
        <button className="catalog-button" onClick={() => { void profile.refetch(); void roles.refetch(); }}>Повторить</button>
      </div>}
      {data && roles.data && (
        <form key={id} onSubmit={submit}>
          <h3>{data.first_name} {data.last_name}</h3>
          <p>{data.email}</p>
          <dl><dt>Дата регистрации</dt><dd>{date(data.date_joined)}</dd>
            <dt>О себе</dt><dd className="admin-comment-text">{data.bio || "Не заполнено"}</dd></dl>
          <div className="admin-user-settings">
          <fieldset disabled={save.isPending}>
            <legend>Роль</legend>
            {data.roles.length > 1 && <p>Выберите одну роль для сохранения.</p>}
            {roles.data.map((role) => (
              <label className="admin-check" key={role.id}>
                <input type="radio" name="roles" value={role.role_name} required
                  defaultChecked={data.roles.length === 1 && data.roles[0] === role.role_name} />
                {roleNames[role.role_name] ?? role.role_name}
              </label>
            ))}
          </fieldset>
          <fieldset disabled={save.isPending}>
            <legend>Активность аккаунта</legend>
            <label className="admin-check">
              <input type="radio" name="active" value="true" required defaultChecked={data.is_active} />Активен
            </label>
            <label className="admin-check">
              <input type="radio" name="active" value="false" required defaultChecked={!data.is_active} />Отключён
            </label>
          </fieldset>
          </div>
            <button className="catalog-button catalog-apply" type="submit" disabled={save.isPending}>
              {save.isPending ? "Сохраняем…" : "Сохранить"}
            </button>
          {(validationError || save.isError) && (
            <p className="login-error" role="alert">{validationError || errorText(save.error)}</p>
          )}
        </form>
      )}
    </section>
  );
}

export function AdminUsers() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<AdminFilters>({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const roles = useQuery({ queryKey: ["admin-roles", user?.id], queryFn: ({ signal }) => getAdminRoles(signal), retry: false });
  const users = useQuery({
    queryKey: ["admin-users", user?.id, filters, page],
    queryFn: ({ signal }) => getAdminUsers({ ...filters, offset: page * 50, limit: 50 }, signal), retry: false,
  });
  return (
    <>
      <h2>Пользователи</h2>
      <Filters apply={(values) => { setFilters(values); setPage(0); }}>
        <label>Поиск<input name="search" type="search" placeholder="Email или имя" /></label>
        <label>Роль<select name="role"><option value="">Все роли</option>
          {roles.data?.map((role) => <option key={role.id} value={role.role_name}>{roleNames[role.role_name] ?? role.role_name}</option>)}
        </select></label>
        <label>Статус<select name="active"><option value="">Все</option><option value="true">Активен</option><option value="false">Отключён</option></select></label>
      </Filters>
      {roles.isError && <p role="alert">Не удалось загрузить роли. <button className="catalog-button" onClick={() => void roles.refetch()}>Повторить</button></p>}
      {selected !== null && <UserEditor key={selected} id={selected} close={() => setSelected(null)} />}
      <Results pending={users.isPending} error={users.error} retry={users.refetch} length={users.data?.length} page={page} setPage={setPage}>
        {Boolean(users.data?.length) && <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Пользователь</th><th>Email</th><th>Роли</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>{users.data?.map((item) => <tr key={item.id}>
            <td>{item.first_name} {item.last_name}</td><td>{item.email}</td>
            <td>{item.roles.map((role) => roleNames[role] ?? role).join(", ") || "—"}</td>
            <td><span className="admin-status" data-active={item.is_active}>{item.is_active ? "Активен" : "Отключён"}</span></td>
            <td><button className="catalog-button" onClick={() => setSelected(item.id)}>Открыть</button></td>
          </tr>)}</tbody>
        </table></div>}
      </Results>
    </>
  );
}

export function AdminLogs() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<AdminFilters>({});
  const [page, setPage] = useState(0);
  const options = useQuery({
    queryKey: ["admin-log-options", user?.id],
    queryFn: ({ signal }) => getAdminLogOptions(signal),
    retry: false,
  });
  const logs = useQuery({
    queryKey: ["admin-logs", user?.id, filters, page],
    queryFn: ({ signal }) => getAdminLogs({ ...filters, offset: page * 50, limit: 50 }, signal), retry: false,
  });
  return (
    <>
      <h2>Журнал активности</h2>
      <Filters apply={(values) => { setFilters(values); setPage(0); }}>
        <label>ID пользователя<input name="user_id" type="number" min="1" /></label>
        <label>Действие
          <input name="action" list="admin-log-actions" placeholder="Начните вводить действие" autoComplete="off" />
          <datalist id="admin-log-actions">
            {options.data?.actions.map((action) => <option key={action} value={action} />)}
          </datalist>
        </label>
        <label>Тип объекта
          <input name="resource_type" list="admin-log-resources" placeholder="Начните вводить тип объекта" autoComplete="off" />
          <datalist id="admin-log-resources">
            {options.data?.resource_types.map((type) => <option key={type} value={type} />)}
          </datalist>
        </label>
        <label>Начало периода<input name="start" type="datetime-local" /></label>
        <label>Конец периода<input name="end" type="datetime-local" /></label>
      </Filters>
      {options.isError && (
        <p role="alert">Не удалось загрузить подсказки.
          <button className="catalog-button" type="button" onClick={() => void options.refetch()}>Повторить</button>
        </p>
      )}
      <Results pending={logs.isPending} error={logs.error} retry={logs.refetch} length={logs.data?.length} page={page} setPage={setPage}>
        {Boolean(logs.data?.length) && <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Дата</th><th>Пользователь</th><th>Действие</th><th>Объект</th></tr></thead>
          <tbody>{logs.data?.map((log) => <tr key={log.id}>
            <td>{date(log.created_at)}</td><td>{log.email ?? "—"}{log.user_id !== null && <small>ID {log.user_id}</small>}</td>
            <td>{log.action}</td><td>{log.resource_type ?? "—"} {log.resource_id ?? ""}</td>
          </tr>)}</tbody>
        </table></div>}
      </Results>
    </>
  );
}

function RemoveComment({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteAdminDiscussion(id),
    onSuccess: () => Promise.all([
      cache.invalidateQueries({ queryKey: ["admin-discussions"] }),
      cache.invalidateQueries({ queryKey: ["lesson-discussions"] }),
    ]),
  });
  return (
    <div>
      {confirm && <p>Удалить сообщение и все ответы на него?</p>}
      <div className="admin-actions">
        <button className="catalog-button catalog-danger" disabled={remove.isPending}
          onClick={() => confirm ? remove.mutate() : setConfirm(true)}>
          {remove.isPending ? "Удаляем…" : confirm ? "Подтвердить удаление" : "Удалить"}
        </button>
        {confirm && <button className="catalog-button" disabled={remove.isPending} onClick={() => setConfirm(false)}>Отмена</button>}
      </div>
      {remove.isError && <p className="login-error" role="alert">{errorText(remove.error)}</p>}
    </div>
  );
}

export function AdminDiscussions() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<AdminFilters>({});
  const [page, setPage] = useState(0);
  const discussions = useQuery({
    queryKey: ["admin-discussions", user?.id, filters, page],
    queryFn: ({ signal }) => getAdminDiscussions({ ...filters, offset: page * 50, limit: 50 }, signal), retry: false,
  });
  return (
    <>
      <h2>Модерация обсуждений</h2>
      <Filters apply={(values) => { setFilters(values); setPage(0); }}>
        <label>Поиск<input name="search" type="search" placeholder="Текст сообщения или email" /></label>
      </Filters>
      <Results pending={discussions.isPending} error={discussions.error} retry={discussions.refetch}
        length={discussions.data?.length} page={page} setPage={setPage}>
        <ul className="admin-discussions">
          {discussions.data?.map((comment) => <li className="catalog-state" key={comment.id}>
            <div className="admin-actions"><strong>{comment.first_name} {comment.last_name}</strong><span>{comment.email}</span>
              <time dateTime={comment.created_at}>{date(comment.created_at)}</time></div>
            <p>Урок «{comment.lesson_title}» · {comment.parent_id ? "Ответ" : "Комментарий"}</p>
            <p className="admin-comment-text">{comment.question_text}</p>
            <RemoveComment id={comment.id} />
          </li>)}
        </ul>
      </Results>
    </>
  );
}
