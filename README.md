Powerlift Load Model (Nuxt 3 SPA + Backend)

Быстрый старт:

1) Установка зависимостей
   npm run install:all

2) Запуск всего проекта (Nuxt + Backend)
   npm run dev

Альтернатива (вручную):
   cd backend && npm install && npm run dev
   cd ../nuxt && npm install && npm run dev

Примечание:
- Если запускать команды в корне проекта, нужен package.json (он есть).
- Backend слушает :3001, Nuxt :3000.

База данных (PostgreSQL):

Локальный запуск (Homebrew PostgreSQL, без Docker):

1) Убедиться, что PostgreSQL запущен
   brew services start postgresql@15

2) Полный сброс и инициализация БД
   npm run db:local:reset

3) Проверка подключения backend к БД
   http://localhost:3001/api/db/health

4) Повторно применить только схему (без полного сброса)
   npm run db:local:init

Docker (опционально):
- Только БД: `docker compose up -d postgres`
- Весь стек: `docker compose up --build`
- В Docker postgres слушает на `localhost:5433`.

Схема и связи:
- SQL-схема лежит в `backend/db/init.sql`.
- Таблицы: `athletes`, `observation_periods`, `rest_baselines`, `training_sessions`.
- Внешние ключи и ограничения:
  - `athletes (1) -> (N) observation_periods`
  - `observation_periods (1) -> (1) rest_baselines` (через `UNIQUE(period_id)`)
  - `observation_periods (1) -> (N) training_sessions`
  - уникальность тренировки: `UNIQUE(period_id, week_no, session_no)`
  - все измеряемые показатели хранятся в едином стандарте `*_points`
