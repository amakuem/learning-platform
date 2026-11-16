import api from "./axios";

export const courseLevels = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export interface CourseSummary {
  id: number;
  title: string;
  description: string | null;
  level: keyof typeof courseLevels | null;
  price: number | string | null;
  category_name: string;
  instructor_name: string;
}

export interface CourseDetails extends CourseSummary {
  instructor_bio: string | null;
  students: number;
  modules: {
    id: number;
    title: string;
    description: string | null;
    lessons: { id: number; title: string }[];
  }[];
}

export interface CourseFilters {
  search?: string;
  category_id?: number;
  level?: keyof typeof courseLevels;
  price_min?: number;
  price_max?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}

interface Category {
  id: number;
  name: string;
}

export const getCategories = async (signal?: AbortSignal) => {
  const response = await api.get<Category[]>("/categories", { signal });
  return response.data;
};

interface CourseList {
  total: number;
  items: CourseSummary[];
}

export const coursePageSize = 20;

export const getCourses = async (offset = 0, signal?: AbortSignal, filters: CourseFilters = {}) => {
  const response = await api.get<CourseList>("/courses", {
    params: { ...filters, limit: coursePageSize, offset },
    signal,
  });
  return response.data;
};

export const getCourse = async (id: number, signal?: AbortSignal) => {
  const response = await api.get<CourseDetails>(`/courses/${id}`, { signal });
  return response.data;
};

export const getMyEnrollments = async (signal?: AbortSignal) => {
  const response = await api.get<{ course_id: number }[]>("/me/enrollments", { signal });
  return response.data;
};

export async function updateEnrollment(courseId: number, enroll: boolean) {
  const path = `/courses/${courseId}/enroll`;
  if (enroll) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}
