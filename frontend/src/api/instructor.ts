import api from "./axios";
import type { CourseDetails } from "./courses";

type CourseModule = CourseDetails["modules"][number];
export interface InstructorCourse extends CourseDetails {
  category_id: number;
  is_published: boolean;
  modules: (Omit<CourseModule, "lessons"> & {
    order: number;
    lessons: { id: number; title: string; duration: number | null; order: number }[];
  })[];
}

export interface QuizOption {
  text: string;
  is_correct: boolean;
}

export interface InstructorQuiz {
  id: number;
  title: string;
  passing_score: number | null;
  questions: { id: number; text: string; points: number | null; options: QuizOption[] }[];
}

export async function getInstructorCourse(id: number, signal?: AbortSignal) {
  return (await api.get<InstructorCourse>(`/instructor/courses/${id}`, { signal })).data;
}

export async function getInstructorQuizzes(id: number, signal?: AbortSignal) {
  return (await api.get<InstructorQuiz[]>(`/instructor/lessons/${id}/quizzes`, { signal })).data;
}

export async function saveInstructorResource(
  method: "post" | "patch" | "delete",
  path: string,
  data?: Record<string, unknown>,
) {
  return (await api.request<{ id: number }>({ method, url: `/instructor${path}`, data })).data;
}
