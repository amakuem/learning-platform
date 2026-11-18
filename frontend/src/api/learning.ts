import api from "./axios";

export interface OutlineLesson {
  id: number;
  title: string;
  progress_status: "not_started" | "in_progress" | "completed";
}

interface LearningCourse {
  id: number;
  title: string;
  modules: { id: number; title: string; lessons: OutlineLesson[] }[];
}

export interface LessonPage {
  id: number;
  title: string;
  order: number;
  sections: {
    id: number;
    type: "text" | "code" | null;
    content: string | null;
    video_url: string | null;
    order: number;
  }[];
}

interface Lesson {
  id: number;
  title: string;
  viewed_page_ids: number[];
  pages: LessonPage[];
}

export interface LessonQuiz {
  id: number;
  title: string;
  passed: boolean;
  passing_score: number | string;
  questions: {
    id: number;
    text: string;
    multiple: boolean;
    options: { id: number; text: string }[];
  }[];
}

interface QuizAttempt {
  score: number | string;
  is_passed: boolean;
}

interface QuizResult extends QuizAttempt {
  earned_points: number | string;
  total_points: number | string;
  review: { question_id: number; is_correct: boolean }[];
}

export async function getLearningCourse(courseId: number, signal?: AbortSignal) {
  const response = await api.get<LearningCourse>(`/me/courses/${courseId}/learning`, { signal });
  return response.data;
}

export async function getLesson(lessonId: number, signal?: AbortSignal) {
  const response = await api.get<Lesson>(`/lessons/${lessonId}`, { signal });
  return response.data;
}

export async function getLessonQuizzes(lessonId: number, signal?: AbortSignal) {
  const response = await api.get<LessonQuiz[]>(`/lessons/${lessonId}/quizzes`, { signal });
  return response.data;
}

export async function submitQuiz(quizId: number, answers: Record<number, number[]>) {
  const response = await api.post<QuizResult>(`/quizzes/${quizId}/attempt`, { answers });
  return response.data;
}

export async function viewLessonPage(lessonId: number, pageId: number) {
  await api.put(`/lessons/${lessonId}/pages/${pageId}/view`);
}
