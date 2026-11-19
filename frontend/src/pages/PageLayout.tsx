import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./login.css";

function CatalogNavigation() {
  const { user, loading, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <nav className="platform-nav" aria-label="Основная навигация">
      {pathname === "/" ? <a href="#courses">Курсы</a> : <Link to="/">Курсы</Link>}
      {!loading && (user ? (
        <>
          {(user.roles.includes("student") || user.roles.includes("instructor")) && (
            <NavLink to="/my-courses">Мои курсы</NavLink>
          )}
          <NavLink to="/profile">Профиль</NavLink>
          {user.roles.includes("admin") && <NavLink to="/admin">Админ-панель</NavLink>}
          <button type="button" onClick={logout}>Выйти</button>
        </>
      ) : (
        <>
          <Link to="/login">Войти</Link>
          <Link className="platform-nav-primary" to="/register">Регистрация</Link>
        </>
      ))}
    </nav>
  );
}

export default function PageLayout({
  children,
  catalog = false,
}: {
  children: ReactNode;
  catalog?: boolean;
}) {
  return (
    <div className="platform-page">
      <header className="platform-header">
        <div className={catalog ? "platform-header-inner platform-header-wide" : "platform-header-inner"}>
          <Link className="platform-brand" to="/">Учебная платформа</Link>
          {catalog && <CatalogNavigation />}
        </div>
      </header>
      <main className={catalog ? "catalog-main" : "platform-main"}>{children}</main>
    </div>
  );
}
