import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  loginRequest,
  registerRequest,
  getMe,
  type User,
} from "../api/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncUser: (updatedUser: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: "student" | "instructor";
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  function syncUser(updatedUser: User) {
    setUser((current) => current?.id === updatedUser.id ? updatedUser : current);
  }

  // Проверяем авторизацию при запуске приложения
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getMe();
        setUser(currentUser);
      } catch {
        localStorage.removeItem("access_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Вход
  const login = async (email: string, password: string) => {
    const response = await loginRequest(email, password);

    localStorage.setItem("access_token", response.access_token);

    const currentUser = await getMe();
    setUser(currentUser);
  };

  // Регистрация
  const register = async (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: "student" | "instructor";
  }) => {
    await registerRequest(data);

    // После регистрации автоматически выполняем вход
    await login(data.email, data.password);
  };

  // Выход
  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, syncUser, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Удобный хук для компонентов
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
