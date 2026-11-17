import api from "./axios";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: string[];
}

export interface UserProfile extends User {
  bio: string | null;
  date_joined: string | null;
}

export async function getProfile(signal?: AbortSignal) {
  const response = await api.get<UserProfile>("/me", { signal });
  return response.data;
}

export type ProfileUpdate = Partial<Pick<UserProfile, "first_name" | "last_name" | "email" | "bio">>;

export async function updateProfile(changes: ProfileUpdate) {
  const response = await api.patch<UserProfile>("/me", changes);
  return response.data;
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
