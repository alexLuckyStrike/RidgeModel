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

1) Поднять только БД
   docker compose up -d postgres

2) Поднять весь стек в Docker (Nuxt + Backend + PostgreSQL + Nginx)
   docker compose up --build

3) Проверка подключения backend к БД
   http://localhost:3001/api/db/health

Схема и связи:
- SQL-схема лежит в `backend/db/init.sql`.
- Таблицы: `athletes`, `sessions`, `uploads`, `analysis_results`, `training_plans`.
- Внешние ключи уже настроены (athletes -> sessions -> uploads/analysis_results, athletes -> training_plans).
