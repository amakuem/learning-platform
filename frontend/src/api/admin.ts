import api from "./axios";
import type { UserProfile } from "./auth";

export interface AdminLog {
  id: number;
  user_id: number | null;
  email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  created_at: string;
}
export interface AdminDiscussion {
  id: number;
  question_text: string;
  email: string;
  first_name: string;
  last_name: string;
  lesson_title: string;
  parent_id: number | null;
  created_at: string;
}
export type AdminFilters = Record<string, string | number>;

export async function getAdminUsers(params: AdminFilters, signal?: AbortSignal) {
  return (await api.get<UserProfile[]>("/admin/users", { params, signal })).data;
}
export async function getAdminUser(id: number, signal?: AbortSignal) {
  return (await api.get<UserProfile>(`/admin/users/${id}`, { signal })).data;
}
export async function getAdminRoles(signal?: AbortSignal) {
  return (await api.get<{ id: number; role_name: string }[]>("/admin/roles", { signal })).data;
}
export async function saveAdminUser(id: number, data: { roles: string[]; is_active: boolean }) {
  return (await api.patch<UserProfile>(`/admin/users/${id}`, data)).data;
}
export async function getAdminLogs(params: AdminFilters, signal?: AbortSignal) {
  return (await api.get<AdminLog[]>("/admin/logs", { params, signal })).data;
}
export async function getAdminLogOptions(signal?: AbortSignal) {
  return (await api.get<{ actions: string[]; resource_types: string[] }>("/admin/logs/options", { signal })).data;
}
export async function getAdminDiscussions(params: AdminFilters, signal?: AbortSignal) {
  return (await api.get<AdminDiscussion[]>("/admin/discussions", { params, signal })).data;
}
export async function deleteAdminDiscussion(id: number) {
  await api.delete(`/discussions/${id}`);
}
