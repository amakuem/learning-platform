import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { getMyEnrollments, updateEnrollment } from "../api/courses";
import { useAuth } from "../context/AuthContext";

function StudentEnrollment({ courseId, userId }: { courseId: number; userId: number }) {
  const unsubscribeDialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const enrollmentKey = ["my-enrollments", userId];
  const enrollments = useQuery({
    queryKey: enrollmentKey,
    queryFn: ({ signal }) => getMyEnrollments(signal),
    retry: false,
  });
  const enrollment = useMutation({
    mutationFn: async (enroll: boolean) => {
      try {
        await updateEnrollment(courseId, enroll);
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status !== (enroll ? 409 : 404)) throw error;
      }
    },
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: enrollmentKey }),
      queryClient.invalidateQueries({ queryKey: ["course", courseId] }),
      queryClient.invalidateQueries({ queryKey: ["courses"] }),
    ]),
  });

  if (enrollments.isPending) return <p role="status">Проверяем запись…</p>;

  if (enrollments.isError) {
    return (
      <>
        <p role="alert">Не удалось проверить запись на курс.</p>
        <button className="catalog-button" type="button" onClick={() => void enrollments.refetch()}>
          Повторить
        </button>
      </>
    );
  }

  const isEnrolled = enrollments.data.some((item) => item.course_id === courseId);
  const updating = enrollment.isPending || enrollments.isFetching;

  return (
    <>
      <p role="status">{isEnrolled ? "Вы записаны на курс" : "Вы ещё не записаны на курс"}</p>
      <button
        className={isEnrolled ? "catalog-button catalog-danger" : "catalog-button catalog-apply"}
        type="button"
        disabled={updating}
        aria-haspopup={isEnrolled ? "dialog" : undefined}
        onClick={() => {
          if (isEnrolled) unsubscribeDialog.current?.showModal();
          else enrollment.mutate(true);
        }}
      >
        {enrollment.isPending ? "Сохраняем…" : isEnrolled ? "Отписаться" : "Записаться на курс"}
      </button>
      {isEnrolled && (
        <dialog
          className="unsubscribe-dialog"
          ref={unsubscribeDialog}
          aria-labelledby="unsubscribe-title"
          aria-describedby="unsubscribe-description"
        >
          <h2 id="unsubscribe-title">Отписаться от курса?</h2>
          <p id="unsubscribe-description">Прогресс по урокам этого курса будет удалён.</p>
          <form className="unsubscribe-actions" method="dialog">
            <button className="catalog-button" type="submit" autoFocus>Отмена</button>
            <button
              className="catalog-button catalog-danger catalog-danger-solid"
              type="button"
              disabled={updating}
              onClick={() => {
                unsubscribeDialog.current?.close();
                enrollment.mutate(false);
              }}
            >
              Отписаться
            </button>
          </form>
        </dialog>
      )}
      {enrollment.isError && <p className="login-error" role="alert">Не удалось изменить запись. Попробуйте ещё раз.</p>}
    </>
  );
}

export default function CourseEnrollment({ courseId }: { courseId: number }) {
  const { user, loading } = useAuth();

  if (loading) return <p role="status">Проверяем вход…</p>;
  if (!user) return <Link className="catalog-button catalog-apply" to="/login" state={{ courseId }}>Войти, чтобы записаться</Link>;
  if (!user.roles.includes("student")) return <p>Запись доступна с ролью студента.</p>;

  return <StudentEnrollment key={`${user.id}:${courseId}`} courseId={courseId} userId={user.id} />;
}
