-- ============ ТЕСТОВЫЕ ДАННЫЕ ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Пользователи (пароли: admin123 / teacher123 / student123)
INSERT INTO users (email, password, first_name, last_name, bio, is_active) VALUES
 ('admin@example.com',    crypt('admin123',   gen_salt('bf')), 'Анна',   'Админова',  'Администратор платформы', TRUE),
 ('teacher@example.com',  crypt('teacher123', gen_salt('bf')), 'Пётр',   'Учителев',  'Преподаватель с 10-летним стажем в разработке', TRUE),
 ('student@example.com',  crypt('student123', gen_salt('bf')), 'Иван',   'Студентов', NULL, TRUE),
 ('student2@example.com', crypt('student123', gen_salt('bf')), 'Мария',  'Учебная',   NULL, TRUE);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM (VALUES
  ('admin@example.com',    'admin'),
  ('teacher@example.com',  'instructor'),
  ('student@example.com',  'student'),
  ('student2@example.com', 'student')
) AS v(email, role_name)
JOIN users u ON u.email = v.email
JOIN roles r ON r.role_name = v.role_name;

-- Категории
INSERT INTO categories (name, slug) VALUES
 ('Программирование', 'programming'),
 ('Базы данных',      'databases'),
 ('Дизайн',           'design');

-- Курсы
INSERT INTO courses (title, description, price, level, instructor_id, category_id, is_published)
SELECT v.title, v.description, v.price, v.level, u.id, c.id, v.published
FROM (VALUES
  ('Python с нуля',
   'Базовый курс по Python: от установки до первых программ.',
   0.00, 'beginner', 'programming', TRUE),
  ('SQL для начинающих',
   'Учимся писать запросы к реляционным базам данных.',
   19.90, 'intermediate', 'databases', TRUE),
  ('Введение в Go',
   'Черновик курса, пока не опубликован.',
   29.90, 'advanced', 'programming', FALSE)
) AS v(title, description, price, level, cat_slug, published)
JOIN users u ON u.email = 'teacher@example.com'
JOIN categories c ON c.slug = v.cat_slug;

-- Модули
INSERT INTO modules (title, description, order_in_course, course_id)
SELECT v.title, v.description, v.ord, c.id
FROM (VALUES
  ('Python с нуля',      'Введение',        'Знакомство с языком и установка',  1),
  ('Python с нуля',      'Основы языка',    'Переменные, условия и циклы',      2),
  ('SQL для начинающих', 'Первые запросы',  'SELECT, WHERE и сортировка',       1),
  ('SQL для начинающих', 'Соединения',      'JOIN и агрегатные функции',        2)
) AS v(course_title, title, description, ord)
JOIN courses c ON c.title = v.course_title;

-- Уроки
INSERT INTO lessons (title, duration, order_in_module, module_id)
SELECT v.title, v.duration, v.ord, m.id
FROM (VALUES
  ('Python с нуля',      'Введение',       'Что такое Python',            10, 1),
  ('Python с нуля',      'Введение',       'Установка и первая программа', 15, 2),
  ('Python с нуля',      'Основы языка',   'Переменные и типы данных',    20, 1),
  ('Python с нуля',      'Основы языка',   'Условия и циклы',             25, 2),
  ('SQL для начинающих', 'Первые запросы', 'Оператор SELECT',             15, 1),
  ('SQL для начинающих', 'Первые запросы', 'Фильтрация и сортировка',     20, 2),
  ('SQL для начинающих', 'Соединения',     'INNER JOIN',                  20, 1)
) AS v(course_title, module_title, title, duration, ord)
JOIN courses c ON c.title = v.course_title
JOIN modules m ON m.course_id = c.id AND m.title = v.module_title;

-- Страницы уроков (по две на урок Python, по одной на остальные)
INSERT INTO lessonpages (title, order_in_lesson, lesson_id)
SELECT v.page_title, v.ord, l.id
FROM (VALUES
  ('Что такое Python',             'Общие сведения', 1),
  ('Что такое Python',             'Где применяется', 2),
  ('Установка и первая программа', 'Установка',       1),
  ('Установка и первая программа', 'Hello, world',    2),
  ('Переменные и типы данных',     'Переменные',      1),
  ('Переменные и типы данных',     'Типы данных',     2),
  ('Условия и циклы',              'Условия if',      1),
  ('Оператор SELECT',              'Синтаксис SELECT', 1),
  ('Фильтрация и сортировка',      'WHERE и ORDER BY', 1),
  ('INNER JOIN',                   'Соединение таблиц', 1)
) AS v(lesson_title, page_title, ord)
JOIN lessons l ON l.title = v.lesson_title;

-- Секции страниц
INSERT INTO pagesections (section_type, content, section_order, video_url, page_id)
SELECT v.stype, v.content, v.ord, v.video, p.id
FROM (VALUES
  ('Общие сведения',  'text', 'Python — высокоуровневый язык программирования общего назначения с простым и читаемым синтаксисом.', 1, NULL),
  ('Общие сведения',  'text', 'Язык используется в вебе, анализе данных, автоматизации и обучении.', 2, NULL),
  ('Где применяется', 'text', 'Python применяют в backend-разработке, машинном обучении и скриптах администрирования.', 1, NULL),
  ('Установка',       'text', 'Скачайте установщик с официального сайта python.org и отметьте галочку Add Python to PATH.', 1, NULL),
  ('Hello, world',    'text', 'Создайте файл main.py со следующим содержимым и запустите его.', 1, NULL),
  ('Hello, world',    'code', $$print("Hello, world!")$$, 2, NULL),
  ('Переменные',      'text', 'Переменная — это имя, связанное со значением. Тип определяется автоматически.', 1, NULL),
  ('Переменные',      'code', $$name = "Иван"
age = 20
print(name, age)$$, 2, NULL),
  ('Типы данных',     'text', 'Основные типы: int, float, str, bool, list, dict.', 1, NULL),
  ('Условия if',      'code', $$x = 5
if x > 3:
    print("больше трёх")
else:
    print("не больше трёх")$$, 1, NULL),
  ('Синтаксис SELECT','text', 'Оператор SELECT выбирает столбцы из таблицы: SELECT name, price FROM products;', 1, NULL),
  ('WHERE и ORDER BY','code', $$SELECT name, price
FROM products
WHERE price > 100
ORDER BY price DESC;$$, 1, NULL),
  ('Соединение таблиц','code', $$SELECT o.id, c.name
FROM orders o
INNER JOIN customers c ON c.id = o.customer_id;$$, 1, NULL)
) AS v(page_title, stype, content, ord, video)
JOIN lessonpages p ON p.title = v.page_title;

-- Тест к уроку «Переменные и типы данных»
INSERT INTO quizzes (title, passing_score, lesson_id)
SELECT 'Тест: переменные и типы', 70, id FROM lessons WHERE title = 'Переменные и типы данных';

-- Формат answers: [{"id": 1, "text": "...", "is_correct": true/false}, ...]
INSERT INTO questions (text, points, answers, quiz_id)
SELECT v.text, v.points, v.answers::jsonb, q.id
FROM (VALUES
  ('Какой тип имеет значение 3.14?', 1,
   '[{"id":1,"text":"int","is_correct":false},{"id":2,"text":"float","is_correct":true},{"id":3,"text":"str","is_correct":false}]'),
  ('Какая функция выводит текст на экран?', 1,
   '[{"id":1,"text":"print()","is_correct":true},{"id":2,"text":"echo()","is_correct":false},{"id":3,"text":"write()","is_correct":false}]'),
  ('Что из перечисленного является строкой?', 1,
   '[{"id":1,"text":"42","is_correct":false},{"id":2,"text":"\"42\"","is_correct":true},{"id":3,"text":"True","is_correct":false}]')
) AS v(text, points, answers)
JOIN quizzes q ON q.title = 'Тест: переменные и типы';

-- Записи на курс
INSERT INTO enrollments (user_id, course_id)
SELECT u.id, c.id FROM (VALUES
  ('student@example.com',  'Python с нуля'),
  ('student@example.com',  'SQL для начинающих'),
  ('student2@example.com', 'Python с нуля')
) AS v(email, title)
JOIN users u ON u.email = v.email
JOIN courses c ON c.title = v.title;

-- Прогресс студента по Python: два урока пройдено, один в процессе
INSERT INTO lesson_progress (status, last_viewed_at, viewed_duration, enrollment_id, lesson_id)
SELECT v.status, now(), v.dur, e.id, l.id
FROM (VALUES
  ('Что такое Python',             'completed',   600),
  ('Установка и первая программа', 'completed',   900),
  ('Переменные и типы данных',     'in_progress', 300)
) AS v(lesson_title, status, dur)
JOIN lessons l ON l.title = v.lesson_title
JOIN users u ON u.email = 'student@example.com'
JOIN courses c ON c.title = 'Python с нуля'
JOIN enrollments e ON e.user_id = u.id AND e.course_id = c.id;

-- Попытки теста: неудачная и успешная
INSERT INTO quiz_attempts (user_id, quiz_id, score, is_passed)
SELECT u.id, q.id, v.score, v.passed
FROM (VALUES (33.33, FALSE), (100.00, TRUE)) AS v(score, passed)
JOIN users u ON u.email = 'student@example.com'
JOIN quizzes q ON q.title = 'Тест: переменные и типы';

-- Обсуждение: вопрос и ответ преподавателя
INSERT INTO discussions (question_text, user_id, lesson_id, parent_id)
SELECT 'Почему в Python не нужно указывать тип переменной?', u.id, l.id, NULL
FROM users u, lessons l
WHERE u.email = 'student@example.com' AND l.title = 'Переменные и типы данных';

INSERT INTO discussions (question_text, user_id, lesson_id, parent_id)
SELECT 'Python — язык с динамической типизацией: тип определяется по значению во время выполнения.',
       u.id, l.id, d.id
FROM users u, lessons l, discussions d
WHERE u.email = 'teacher@example.com'
  AND l.title = 'Переменные и типы данных'
  AND d.parent_id IS NULL;