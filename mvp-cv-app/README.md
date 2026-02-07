# MVP 0.1 — Расшифровка индикаторных полосок (Vue 3 + Node + Python)

Это тестовое приложение для демонстрации пайплайна:
- загрузка 2 шкал (×2 и ×5)
- загрузка полосок в режиме **Покой** и **После нагрузки**
- загрузка фото с текстом для OCR
- возврат результата в виде таблиц и JSON

> Важно: в **MVP 0.1** шкала парсится **эвристически** (кластеризация цветов на фото шкалы). Уровни шкалы в результате будут маркированы как `L1..Ln`.

## Запуск

### 1) Backend (Node)

```bash
cd mvp-cv-app/backend
npm install
npm run dev
```

Backend: `http://localhost:4000`

### 2) Python (CV + OCR)

```bash
cd mvp-cv-app/vision
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

OCR (необязательно): для `pytesseract` нужен установленный `tesseract` в системе.
Если его нет, приложение вернёт предупреждение в блоке OCR.

### 3) Frontend (Vue 3)

```bash
cd mvp-cv-app/frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Структура данных

Загруженные файлы сохраняются в `mvp-cv-app/data/uploads/<session>`.
Результаты сохраняются в `mvp-cv-app/data/results/<session>_result.json`.
