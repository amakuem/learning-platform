import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { getProfile, updateProfile, type ProfileUpdate, type UserProfile } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import PageLayout from "./PageLayout";
import "./home.css";
import "./profile.css";

const roleNames: Record<string, string> = {
  student: "Студент",
  instructor: "Преподаватель",
  admin: "Администратор",
};

const dateFormat = new Intl.DateTimeFormat("ru-BY", { dateStyle: "long" });

export default function Profile() {
  const { user, syncUser } = useAuth();
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const queryClient = useQueryClient();
  const profileKey = ["profile", user?.id];
  const profile = useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => getProfile(signal),
    enabled: Boolean(user),
    retry: false,
  });
  const saveProfile = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (updated) => {
      await queryClient.cancelQueries({ queryKey: profileKey, exact: true });
      queryClient.setQueryData(profileKey, updated);
      syncUser(updated);
      setEditing(null);
      setMessage("Изменения сохранены.");
    },
  });
  const data = profile.data;
  const saveStatus = isAxiosError(saveProfile.error) ? saveProfile.error.response?.status : undefined;
  const error = validationError || (saveProfile.isError
    ? saveStatus === 409
      ? "Этот email уже используется другим аккаунтом."
      : saveStatus === 422
        ? "Проверьте формат email и длину введённых данных."
        : "Не удалось сохранить профиль. Попробуйте ещё раз."
    : "");

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saveProfile.isPending) return;
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("first_name")).trim();
    const lastName = String(form.get("last_name")).trim();
    const email = String(form.get("email")).trim();
    const bio = String(form.get("bio")).trim() || null;
    saveProfile.reset();

    if (!firstName || !lastName) {
      setValidationError("Введите имя и фамилию.");
      return;
    }

    setValidationError("");
    const changes: ProfileUpdate = {};
    if (firstName !== editing.first_name) changes.first_name = firstName;
    if (lastName !== editing.last_name) changes.last_name = lastName;
    if (email !== editing.email) changes.email = email;
    if (bio !== (editing.bio || null)) changes.bio = bio;
    if (Object.keys(changes).length > 0) saveProfile.mutate(changes);
    else setEditing(null);
  }

  function startEditing(current: UserProfile) {
    setMessage("");
    setValidationError("");
    saveProfile.reset();
    setEditing(current);
  }

  return (
    <PageLayout catalog>
      <div className="catalog-heading"><h1>Профиль</h1></div>
      {profile.isPending && <p className="catalog-state" role="status">Загружаем профиль…</p>}
      {profile.isError && (
        <div className="catalog-state">
          <p role="alert">Не удалось загрузить профиль.</p>
          <button className="catalog-button" type="button" onClick={() => void profile.refetch()}>Повторить</button>
        </div>
      )}
      {data && (
        <div className="profile-panel">
          <header className="profile-banner">
            <span className="profile-avatar" aria-hidden="true">
              {data.first_name.slice(0, 1)}{data.last_name.slice(0, 1)}
            </span>
            <div className="profile-identity">
              <h2>{data.first_name} {data.last_name}</h2>
              {data.roles.length > 0 && (
                <ul className="profile-roles" aria-label="Роли">
                  {data.roles.map((role) => <li key={role}>{roleNames[role] ?? role}</li>)}
                </ul>
              )}
            </div>
            {!editing && (
              <button className="catalog-button" type="button" onClick={() => startEditing(data)}>
                Редактировать профиль
              </button>
            )}
          </header>
          <section className="profile-details" aria-labelledby="profile-details-title">
            <h2 id="profile-details-title">Личные данные</h2>
            {message && <p className="profile-success" role="status">{message}</p>}
            {editing ? (
              <form className="login-form" onSubmit={handleSave}>
                <fieldset disabled={saveProfile.isPending} className="profile-fields">
                  <div className="register-name-fields">
                    <label className="login-field">
                      Имя
                      <input className="login-input" name="first_name" autoComplete="given-name" defaultValue={editing.first_name} maxLength={100} required />
                    </label>
                    <label className="login-field">
                      Фамилия
                      <input className="login-input" name="last_name" autoComplete="family-name" defaultValue={editing.last_name} maxLength={100} required />
                    </label>
                  </div>
                  <label className="login-field">
                    Email
                    <input className="login-input" name="email" type="email" autoComplete="email" defaultValue={editing.email} required />
                  </label>
                  <label className="login-field">
                    О себе
                    <textarea className="login-input" name="bio" rows={4} maxLength={5000} defaultValue={editing.bio ?? ""} />
                  </label>
                  {error && <p className="login-error" role="alert">{error}</p>}
                  <div className="profile-actions">
                    <button className="catalog-button catalog-apply" type="submit">
                      {saveProfile.isPending ? "Сохраняем…" : "Сохранить"}
                    </button>
                    <button className="catalog-button" type="button" onClick={() => setEditing(null)}>Отмена</button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <dl>
                <div><dt>Email</dt><dd>{data.email}</dd></div>
                {data.date_joined && (
                  <div><dt>Дата регистрации</dt><dd>{dateFormat.format(new Date(data.date_joined))}</dd></div>
                )}
                <div><dt>О себе</dt><dd className="profile-bio">{data.bio || "Пока не заполнено"}</dd></div>
              </dl>
            )}
          </section>
        </div>
      )}
    </PageLayout>
  );
}
