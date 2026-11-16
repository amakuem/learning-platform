import { isAxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLayout from "./PageLayout";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("first_name")).trim();
    const lastName = String(form.get("last_name")).trim();
    const password = String(form.get("password"));

    if (!firstName || !lastName) {
      setError("Введите имя и фамилию.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Сократите пароль. Допустимо не более 72 байт.");
      return;
    }

    setLoading(true);
    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email: String(form.get("email")).trim(),
        password,
        role: form.get("role") === "instructor" ? "instructor" : "student",
      });
      navigate("/");
    } catch (error) {
      setError(isAxiosError(error) && error.response?.status === 409
        ? "Аккаунт с таким email уже существует."
        : "Не удалось завершить регистрацию. Проверьте данные и попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageLayout>
      <section className="login-card register-card" aria-labelledby="register-title">
        <h1 className="login-title" id="register-title">Регистрация</h1>
        <p className="login-subtitle">Создайте аккаунт на учебной платформе</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="register-name-fields">
            <label className="login-field">
              Имя
              <input className="login-input" name="first_name" autoComplete="given-name" maxLength={100} required />
            </label>
            <label className="login-field">
              Фамилия
              <input className="login-input" name="last_name" autoComplete="family-name" maxLength={100} required />
            </label>
          </div>
          <label className="login-field">
            Email
            <input className="login-input" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="login-field">
            Пароль
            <input className="login-input" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={72} placeholder="От 6 символов" required />
          </label>
          <label className="login-field">
            Роль
            <select className="login-input" name="role" defaultValue="student">
              <option value="student">Студент</option>
              <option value="instructor">Преподаватель</option>
            </select>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
          </button>
        </form>
        <p className="login-footer">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </section>
    </PageLayout>
  );
}

export default Register;
