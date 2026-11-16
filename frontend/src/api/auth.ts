import api from "./axios";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: string[];
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "student" | "instructor";
}

// Вход
export const loginRequest = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  return response.data;
};

// Регистрация
export const registerRequest = async (data: RegisterData) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

// Получение текущего пользователя
export const getMe = async (): Promise<User> => {
  const response = await api.get("/auth/me");
  return response.data;
};