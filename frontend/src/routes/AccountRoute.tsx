import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLayout from "../pages/PageLayout";

export default function AccountRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <PageLayout catalog><p className="catalog-state" role="status">Проверяем вход…</p></PageLayout>;
  }

  return user ? children : <Navigate to="/login" state={{ accountPath: pathname }} replace />;
}
