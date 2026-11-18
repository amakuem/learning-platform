import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { discussionMaxLength, getDiscussions, postDiscussion, type DiscussionComment } from "../api/discussions";

const dateFormat = new Intl.DateTimeFormat("ru-BY", { dateStyle: "medium", timeStyle: "short" });

function orderThread(comments: DiscussionComment[]) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const children = new Map<number | null, DiscussionComment[]>();
  for (const comment of comments) {
    const parent = comment.parent_id !== null && byId.has(comment.parent_id) ? comment.parent_id : null;
    const group = children.get(parent) ?? [];
    group.push(comment);
    children.set(parent, group);
  }

  const ordered: { comment: DiscussionComment; parent?: DiscussionComment }[] = [];
  const pending = [...(children.get(null) ?? [])].reverse();
  while (pending.length > 0) {
    const comment = pending.pop()!;
    ordered.push({ comment, parent: comment.parent_id === null ? undefined : byId.get(comment.parent_id) });
    const replies = children.get(comment.id) ?? [];
    for (let index = replies.length - 1; index >= 0; index--) pending.push(replies[index]);
  }
  return ordered;
}

type DiscussionKey = readonly ["lesson-discussions", number, number];

function CommentForm({ queryKey, parent, onClose }: {
  queryKey: DiscussionKey;
  parent?: DiscussionComment;
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const post = useMutation({
    mutationFn: (value: string) => postDiscussion(queryKey[2], value, parent?.id ?? null),
    onSuccess: async (created) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<DiscussionComment[]>(queryKey, (current = []) =>
        current.some((comment) => comment.id === created.id) ? current : [...current, created],
      );
      setText("");
      onClose?.();
      void queryClient.invalidateQueries({ queryKey, exact: true });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (value && !post.isPending) post.mutate(value);
  }

  return (
    <form className="discussion-form" onSubmit={submit}>
      <label className="login-field">
        {parent ? `Ответ для ${parent.first_name} ${parent.last_name}` : "Ваш комментарий"}
        <textarea
          className="login-input"
          rows={3}
          value={text}
          maxLength={discussionMaxLength}
          required
          readOnly={post.isPending}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {post.isError && <p className="login-error" role="alert">Не удалось отправить сообщение. Попробуйте ещё раз.</p>}
      <div className="discussion-actions">
        <button className="catalog-button catalog-apply" type="submit" disabled={!text.trim() || post.isPending}>
          {post.isPending ? "Отправляем…" : parent ? "Отправить ответ" : "Написать комментарий"}
        </button>
        {onClose && <button className="catalog-button" type="button" disabled={post.isPending} onClick={onClose}>Отмена</button>}
      </div>
    </form>
  );
}

export default function LessonDiscussion({ lessonId, userId }: { lessonId: number; userId: number }) {
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const queryKey: DiscussionKey = ["lesson-discussions", userId, lessonId];
  const discussion = useQuery({
    queryKey,
    queryFn: ({ signal }) => getDiscussions(lessonId, signal),
    retry: false,
  });

  return (
    <section className="catalog-state lesson-discussion" aria-labelledby="lesson-discussion-title">
      <h2 id="lesson-discussion-title">Обсуждение урока</h2>
      {discussion.isPending && <p role="status">Загружаем комментарии…</p>}
      {discussion.isError && (
        <div>
          <p role="alert">Не удалось загрузить комментарии.</p>
          <button className="catalog-button" type="button" onClick={() => void discussion.refetch()}>Повторить</button>
        </div>
      )}
      {discussion.data && (
        <>
          <CommentForm queryKey={queryKey} />
          {discussion.data.length === 0 ? <p className="discussion-empty">Комментариев пока нет.</p> : (
            <ul className="discussion-list">
              {orderThread(discussion.data).map(({ comment, parent }) => (
                <li key={comment.id} className={parent ? "discussion-comment discussion-reply" : "discussion-comment"}>
                  <div className="discussion-meta">
                    <strong>{comment.first_name} {comment.last_name}</strong>
                    <time dateTime={comment.created_at}>{dateFormat.format(new Date(comment.created_at))}</time>
                  </div>
                  {parent && <span className="discussion-recipient">Ответ для {parent.first_name} {parent.last_name}</span>}
                  <p className="discussion-text">{comment.question_text}</p>
                  {replyTo === comment.id ? (
                    <CommentForm
                      queryKey={queryKey}
                      parent={comment}
                      onClose={() => setReplyTo((current) => current === comment.id ? null : current)}
                    />
                  ) : (
                    <button className="catalog-button" type="button" onClick={() => setReplyTo(comment.id)}>Ответить</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
