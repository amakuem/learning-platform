import api from "./axios";

export const discussionMaxLength = 10000;

export interface DiscussionComment {
  id: number;
  question_text: string;
  created_at: string;
  parent_id: number | null;
  first_name: string;
  last_name: string;
}

export async function getDiscussions(lessonId: number, signal?: AbortSignal) {
  const response = await api.get<DiscussionComment[]>(`/lessons/${lessonId}/discussions`, { signal });
  return response.data;
}

export async function postDiscussion(lessonId: number, text: string, parentId: number | null) {
  const response = await api.post<DiscussionComment>(`/lessons/${lessonId}/discussions`, {
    question_text: text,
    parent_id: parentId,
  });
  return response.data;
}
