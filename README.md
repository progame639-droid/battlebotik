# AI Battle Arena 🥊

Два ИИ спорят друг с другом, арбитр выносит вердикт.

## Деплой на Vercel (5 минут)

### 1. Загрузи на GitHub
- Создай новый репозиторий на github.com
- Загрузи все файлы: index.html, api/battle.js, vercel.json

### 2. Деплой на Vercel
- Зайди на vercel.com → "Add New Project"
- Импортируй репозиторий с GitHub
- Нажми Deploy (настройки менять не надо)

### 3. Добавь API ключ (ВАЖНО)
- В Vercel → Settings → Environment Variables
- Добавь переменную:
  - Name:  OPENROUTER_API_KEY
  - Value: sk-or-v1-твой-ключ-здесь
- Нажми Save → Redeploy

### Где взять ключ
openrouter.ai/keys — бесплатно, через Google

## Структура
```
index.html      — фронтенд (сайт)
api/battle.js   — бэкенд (прокси к OpenRouter, прячет ключ)
vercel.json     — конфиг роутинга
```

## Модели (все бесплатные)
- Bot A: meta-llama/llama-3.3-70b-instruct:free
- Bot B: qwen/qwen3-next-80b-a3b-instruct:free  
- Арбитр: openai/gpt-oss-120b:free
