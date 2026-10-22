CREATE TABLE IF NOT EXISTS Users (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    bio         TEXT,
    date_joined TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_active   BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS Roles (
    id        BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS User_Roles (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE RESTRICT,
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS Categories (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS Courses (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) DEFAULT 0.00,
    level         VARCHAR(50) CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    instructor_id BIGINT NOT NULL,
    category_id   BIGINT NOT NULL,
    is_published  BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_courses_instructor FOREIGN KEY (instructor_id) REFERENCES Users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_courses_category   FOREIGN KEY (category_id)   REFERENCES Categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Modules (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    order_in_course INT NOT NULL,
    course_id       BIGINT NOT NULL,
    CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE,
    CONSTRAINT unique_module_order UNIQUE (course_id, order_in_course)
);

CREATE TABLE IF NOT EXISTS Lessons (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    duration        INT DEFAULT 0,
    order_in_module INT NOT NULL,
    module_id       BIGINT NOT NULL,
    CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES Modules(id) ON DELETE CASCADE,
    CONSTRAINT unique_lesson_order UNIQUE (module_id, order_in_module)
);

CREATE TABLE IF NOT EXISTS LessonPages (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    order_in_lesson INT NOT NULL,
    lesson_id       BIGINT NOT NULL,
    CONSTRAINT fk_lessonpages_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) ON DELETE CASCADE,
    CONSTRAINT unique_page_order UNIQUE (lesson_id, order_in_lesson)
);

CREATE TABLE IF NOT EXISTS PageSections (
    section_id    BIGSERIAL PRIMARY KEY,
    section_type  VARCHAR(50) CHECK (section_type IN ('text', 'code')),
    content       TEXT,
    section_order INT NOT NULL,
    video_url     VARCHAR(500),
    page_id       BIGINT NOT NULL,
    CONSTRAINT fk_pagesections_page FOREIGN KEY (page_id) REFERENCES LessonPages(id) ON DELETE CASCADE,
    CONSTRAINT unique_section_order UNIQUE (page_id, section_order)
);

CREATE TABLE IF NOT EXISTS Quizzes (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    passing_score INT DEFAULT 70,
    lesson_id     BIGINT NOT NULL,
    CONSTRAINT fk_quizzes_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Questions (
    id      BIGSERIAL PRIMARY KEY,
    text    TEXT NOT NULL,
    points  INT DEFAULT 1,
    answers JSONB,
    quiz_id BIGINT NOT NULL,
    CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES Quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Quiz_Attempts (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL,
    quiz_id      BIGINT NOT NULL,
    score        DECIMAL(5,2) NOT NULL,
    is_passed    BOOLEAN DEFAULT FALSE,
    attempt_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quiz_attempts_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES Quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Discussions (
    id            BIGSERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    user_id       BIGINT NOT NULL,
    lesson_id     BIGINT NOT NULL,
    parent_id     BIGINT,
    CONSTRAINT fk_discussions_user   FOREIGN KEY (user_id)   REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_discussions_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) ON DELETE CASCADE,
    CONSTRAINT fk_discussions_parent FOREIGN KEY (parent_id) REFERENCES Discussions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Enrollments (
    id                BIGSERIAL PRIMARY KEY,
    enrollment_date   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completion_status VARCHAR(50) DEFAULT 'in_progress'
        CHECK (completion_status IN ('not_started', 'in_progress', 'completed')),
    final_grade       DECIMAL(5,2) DEFAULT 0.00,
    user_id           BIGINT NOT NULL,
    course_id         BIGINT NOT NULL,
    CONSTRAINT fk_enrollments_user   FOREIGN KEY (user_id)   REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_course UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS Lesson_Progress (
    id              BIGSERIAL PRIMARY KEY,
    status          VARCHAR(50) DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    last_viewed_at  TIMESTAMPTZ,
    viewed_duration INT DEFAULT 0,
    enrollment_id   BIGINT NOT NULL,
    lesson_id       BIGINT NOT NULL,
    CONSTRAINT fk_lessonprogress_enrollment FOREIGN KEY (enrollment_id) REFERENCES Enrollments(id) ON DELETE CASCADE,
    CONSTRAINT fk_lessonprogress_lesson     FOREIGN KEY (lesson_id)     REFERENCES Lessons(id) ON DELETE CASCADE,
    CONSTRAINT unique_enrollment_lesson UNIQUE (enrollment_id, lesson_id)
);

-- Без FK на Users намеренно: журнал должен переживать удаление сущностей
CREATE TABLE IF NOT EXISTS UserActivityLogs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id   BIGINT,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============ ИНДЕКСЫ ПО ВНЕШНИМ КЛЮЧАМ ============
-- (UNIQUE-ограничения уже создают индексы для user_roles, modules, lessons,
--  lessonpages, pagesections, enrollments, lesson_progress)

CREATE INDEX IF NOT EXISTS idx_courses_instructor   ON Courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_category     ON Courses(category_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson       ON Quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz       ON Questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz   ON Quiz_Attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_discussions_lesson   ON Discussions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent   ON Discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_lessonprogress_lesson ON Lesson_Progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_created    ON UserActivityLogs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_action          ON UserActivityLogs(action);

-- ============ НАЧАЛЬНЫЕ ДАННЫЕ ============

INSERT INTO Roles (role_name) VALUES ('student'), ('instructor'), ('admin')
ON CONFLICT (role_name) DO NOTHING;

-- ============ ТРИГГЕРЫ ============

-- Вспомогательная функция: пропускает запись, если пользователь не определён
-- (случай каскадного удаления, когда родительский курс уже удалён)
CREATE OR REPLACE FUNCTION log_activity(
    p_user BIGINT, p_action VARCHAR, p_type VARCHAR, p_id BIGINT
) RETURNS VOID AS $$
BEGIN
    IF p_user IS NOT NULL THEN
        INSERT INTO UserActivityLogs (user_id, action, resource_type, resource_id)
        VALUES (p_user, p_action, p_type, p_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Users
CREATE OR REPLACE FUNCTION trg_user_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(NEW.id, 'USER_REGISTERED', 'Users', NEW.id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_user_login() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login IS DISTINCT FROM OLD.last_login THEN
        PERFORM log_activity(NEW.id, 'USER_LOGGED_IN', 'Users', NEW.id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_user_profile() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email
       OR NEW.first_name IS DISTINCT FROM OLD.first_name
       OR NEW.last_name IS DISTINCT FROM OLD.last_name
       OR NEW.bio IS DISTINCT FROM OLD.bio THEN
        PERFORM log_activity(NEW.id, 'PROFILE_UPDATED', 'Users', NEW.id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_user_deactivate() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
        PERFORM log_activity(NEW.id, 'USER_DEACTIVATED', 'Users', NEW.id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_user_insert
    AFTER INSERT ON Users FOR EACH ROW EXECUTE FUNCTION trg_user_insert();
CREATE OR REPLACE TRIGGER after_user_login_update
    AFTER UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION trg_user_login();
CREATE OR REPLACE TRIGGER after_user_update
    AFTER UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION trg_user_profile();
CREATE OR REPLACE TRIGGER after_user_deactivate
    AFTER UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION trg_user_deactivate();

-- Enrollments
CREATE OR REPLACE FUNCTION trg_enrollment_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(NEW.user_id, 'COURSE_ENROLLED', 'Courses', NEW.course_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_enrollment_completed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completion_status = 'completed' AND OLD.completion_status <> 'completed' THEN
        PERFORM log_activity(NEW.user_id, 'COURSE_COMPLETED', 'Courses', NEW.course_id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_enrollment_delete() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(OLD.user_id, 'COURSE_UNENROLLED', 'Courses', OLD.course_id);
    RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_enrollment_insert
    AFTER INSERT ON Enrollments FOR EACH ROW EXECUTE FUNCTION trg_enrollment_insert();
CREATE OR REPLACE TRIGGER after_enrollment_completion_update
    AFTER UPDATE ON Enrollments FOR EACH ROW EXECUTE FUNCTION trg_enrollment_completed();
CREATE OR REPLACE TRIGGER before_enrollment_delete
    BEFORE DELETE ON Enrollments FOR EACH ROW EXECUTE FUNCTION trg_enrollment_delete();

-- Discussions
CREATE OR REPLACE FUNCTION trg_discussion_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        NEW.user_id,
        CASE WHEN NEW.parent_id IS NULL THEN 'DISCUSSION_STARTED' ELSE 'DISCUSSION_REPLIED' END,
        'Discussions', NEW.id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_discussion_delete() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(OLD.user_id, 'DISCUSSION_DELETED', 'Discussions', OLD.id);
    RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_discussion_insert
    AFTER INSERT ON Discussions FOR EACH ROW EXECUTE FUNCTION trg_discussion_insert();
CREATE OR REPLACE TRIGGER before_discussion_delete
    BEFORE DELETE ON Discussions FOR EACH ROW EXECUTE FUNCTION trg_discussion_delete();

-- Courses
CREATE OR REPLACE FUNCTION trg_course_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(NEW.instructor_id, 'COURSE_CREATED', 'Courses', NEW.id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_course_publish() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_published = TRUE AND OLD.is_published = FALSE THEN
        PERFORM log_activity(NEW.instructor_id, 'COURSE_PUBLISHED', 'Courses', NEW.id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_course_update() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.level IS DISTINCT FROM OLD.level THEN
        PERFORM log_activity(NEW.instructor_id, 'COURSE_UPDATED', 'Courses', NEW.id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_course_delete() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(OLD.instructor_id, 'COURSE_DELETED', 'Courses', OLD.id);
    RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_course_insert
    AFTER INSERT ON Courses FOR EACH ROW EXECUTE FUNCTION trg_course_insert();
CREATE OR REPLACE TRIGGER after_course_publish
    AFTER UPDATE ON Courses FOR EACH ROW EXECUTE FUNCTION trg_course_publish();
CREATE OR REPLACE TRIGGER after_course_update
    AFTER UPDATE ON Courses FOR EACH ROW EXECUTE FUNCTION trg_course_update();
CREATE OR REPLACE TRIGGER before_course_delete
    BEFORE DELETE ON Courses FOR EACH ROW EXECUTE FUNCTION trg_course_delete();

-- Modules
CREATE OR REPLACE FUNCTION trg_module_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        (SELECT instructor_id FROM Courses WHERE id = NEW.course_id),
        'MODULE_CREATED', 'Modules', NEW.id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_module_delete() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        (SELECT instructor_id FROM Courses WHERE id = OLD.course_id),
        'MODULE_DELETED', 'Modules', OLD.id);
    RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_module_insert
    AFTER INSERT ON Modules FOR EACH ROW EXECUTE FUNCTION trg_module_insert();
CREATE OR REPLACE TRIGGER before_module_delete
    BEFORE DELETE ON Modules FOR EACH ROW EXECUTE FUNCTION trg_module_delete();

-- Lessons
CREATE OR REPLACE FUNCTION trg_lesson_insert() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        (SELECT c.instructor_id FROM Courses c JOIN Modules m ON m.course_id = c.id
         WHERE m.id = NEW.module_id),
        'LESSON_CREATED', 'Lessons', NEW.id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_lesson_delete() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        (SELECT c.instructor_id FROM Courses c JOIN Modules m ON m.course_id = c.id
         WHERE m.id = OLD.module_id),
        'LESSON_DELETED', 'Lessons', OLD.id);
    RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_lesson_insert
    AFTER INSERT ON Lessons FOR EACH ROW EXECUTE FUNCTION trg_lesson_insert();
CREATE OR REPLACE TRIGGER before_lesson_delete
    BEFORE DELETE ON Lessons FOR EACH ROW EXECUTE FUNCTION trg_lesson_delete();

-- Lesson_Progress
CREATE OR REPLACE FUNCTION trg_lesson_progress() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM log_activity(
            (SELECT user_id FROM Enrollments WHERE id = NEW.enrollment_id),
            'LESSON_PROGRESS_UPDATED', 'Lessons', NEW.lesson_id);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_lesson_progress_update
    AFTER UPDATE ON Lesson_Progress FOR EACH ROW EXECUTE FUNCTION trg_lesson_progress();

-- Quiz_Attempts
CREATE OR REPLACE FUNCTION trg_quiz_attempt() RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_activity(
        NEW.user_id,
        CASE WHEN NEW.is_passed THEN 'QUIZ_PASSED' ELSE 'QUIZ_FAILED' END,
        'Quizzes', NEW.quiz_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER after_quiz_attempt_insert
    AFTER INSERT ON Quiz_Attempts FOR EACH ROW EXECUTE FUNCTION trg_quiz_attempt();