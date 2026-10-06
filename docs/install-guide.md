# Руководство по установке
## Артефакт: Наследие (Archaeo-expedition)

**Версия:** 1.0
**Дата:** 06.10.2026

---

## 1. Требования

### Обязательные
- **Node.js 20 LTS** (или 18+). Node 16 **не поддерживается** — Vitest 2.1 требует Node 18+.
- **npm 10+** (идёт в комплекте с Node 20).
- **Git** для клонирования репозитория.
- **Современный браузер:** Chrome 100+, Firefox 100+, Edge 100+.

### Опциональные
- **VS Code** с расширениями TypeScript и ESLint — рекомендуется.
- **nvm** (Node Version Manager) — если нет прав администратора.

### Проверка версий

```bash
node -v   # должно быть v20.x.x
npm -v    # должно быть 10.x.x
git --version
```

---

## 2. Установка

### 2.1. Клонирование репозитория

```bash
git clone https://github.com/Flomikc/Archaeo-expedition.git
cd Archaeo-expedition
```

### 2.2. Установка зависимостей

```bash
npm install
```

Устанавливается ~64 пакета, из которых основные:
- `@babylonjs/core` — 3D-движок.
- `vite` — сборщик.
- `typescript` — компилятор.
- `vitest` — тестовый раннер.
- `happy-dom` — DOM-окружение для тестов.

### 2.3. Запуск в режиме разработки

```bash
npm run dev
```

Откройте в браузере: **http://localhost:5173**

Горячая перезагрузка работает: при изменении `.ts`-файлов страница обновляется автоматически.

---

## 3. Настройка

### 3.1. Установка Node.js 20 без прав администратора (Linux)

Если в системе Node 16 или ниже — используйте **nvm**:

```bash
# Установка nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Установка Node 20
nvm install 20
node -v   # проверка: должно быть v20.x.x
```

После этого переустановите зависимости:

```bash
rm -rf node_modules package-lock.json
npm install
```

### 3.2. Настройки игры

Внутриигровые настройки (сохраняются в `localStorage`):

- **Чувствительность мыши** — `ESC` → Пауза.
- **Пучок фонарика** — колесо мыши в игре или ползунок в паузе.

Отдельных конфигурационных файлов нет.

---

## 4. Развёртывание

### 4.1. Production-сборка

```bash
npm run build
```

Соберёт всё в папку `dist/`:
- Минифицированный JS.
- HTML + CSS.
- Готово к публикации.

### 4.2. Проверка сборки

```bash
npm run preview
```

Откройте **http://localhost:4173** — увидите production-версию.

### 4.3. Публикация

**GitHub Pages** (рекомендуется):

1. Push в `main`.
2. Settings → Pages → Source: `GitHub Actions`.
3. Сборка запустится автоматически, сайт будет доступен по адресу `https://Flomikc.github.io/Archaeo-expedition/`.

**Яндекс Игры:**

1. Соберите проект: `npm run build`.
2. Заархивируйте содержимое `dist/` (не саму папку).
3. Загрузите на Яндекс Игры через консоль разработчика.
4. Требования: `index.html` в корне архива, размер ≤ 100 МБ.

---

## 5. Тесты и CI

### 5.1. Запуск тестов локально

```bash
npm test
```

Должно быть **28/28 пройдено** за ~2 сек.

### 5.2. Покрытие тестами

```bash
npx vitest run --coverage
```

Целевое покрытие — 70%. Текущее — **86.61%** по бизнес-логике.

### 5.3. Непрерывная интеграция

GitHub Actions запускается автоматически:
- На каждый `push` в `main`.
- На каждый Pull Request.

Файл workflow: `.github/workflows/test.yml`.

---

## 6. Решение проблем

### 6.1. Ошибка `EBADENGINE`

```
npm WARN EBADENGINE Unsupported engine {
  required: { node: '^18.0.0 || >=20.0.0' },
  current: { node: 'v16.20.3' }
}
```

**Причина:** Node 16 устарел, Vitest 2.1 требует Node 18+.

**Решение:** обновите Node до 20 LTS (см. раздел 3.1).

### 6.2. Ошибка `Missing script: "test"`

**Причина:** в `package.json` не прописан скрипт `test`.

**Решение:** добавьте в блок `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 6.3. Тесты не найдены (`No test files found`)

**Причина:** в папке `tests/` нет файлов `*.test.ts`.

**Решение:** убедитесь, что все 5 файлов на месте:
- `save-system.test.ts`
- `shop-system.test.ts`
- `artifact-system.test.ts`
- `level-generator.test.ts`
- `performance.test.ts`
- `setup.ts` (вспомогательный)

### 6.4. Ошибка `Cannot set properties of null (setting 'fillStyle')`

**Причина:** `DynamicTexture.getContext()` возвращает `null` в тестовой среде (`NullEngine`).

**Решение:** в коде должна быть проверка `if (ctx) { ... }` перед работой с контекстом (исправлено в `LevelGenerator.createMaterials`).

### 6.5. 404 на `favicon.ico`

**Причина:** браузер автоматически запрашивает иконку вкладки.

**Решение:** добавлена SVG-иконка в `index.html`. Если ошибка осталась — проверьте `<link rel="icon" ...>` в `<head>`.

### 6.6. Push отклонён с ошибкой `refusing to allow a Personal Access Token to create or update workflow`

**Причина:** токен GitHub создан без scope `workflow`.

**Решение:** откройте https://github.com/settings/tokens, пересоздайте токен с галочками `repo` и **`workflow`**.

### 6.7. Ошибка `EACCES` при `npm install` (Linux)

**Причина:** npm пытается писать в системные папки.

**Решение:** не используйте `sudo npm install`. Вместо этого настройте nvm (раздел 3.1) или установите Node локально в `~/.local/`.

### 6.8. Игра не загружается / чёрный экран

**Причина:** браузер не поддерживает WebGL 2.

**Решение:** обновите браузер. Проверьте на https://get.webgl.org/webgl2/ — должно быть «Your browser supports WebGL 2».

---

## 7. Полезные команды

| Команда | Что делает |
|---------|-----------|
| `npm run dev` | Запуск в режиме разработки |
| `npm run build` | Production-сборка |
| `npm run preview` | Проверка production-сборки |
| `npm test` | Прогон всех тестов |
| `npm run test:watch` | Тесты в watch-режиме |
| `npm run test:coverage` | Отчёт о покрытии |
| `git status` | Состояние репозитория |
| `git log --oneline -5` | Последние 5 коммитов |

---

## 8. Структура проекта

```
Archaeo-expedition/
├── docs/               # Документация
│   ├── user-guide.md
│   ├── install-guide.md
│   ├── quality-metrics.md
│   ├── bug-reports.md
│   ├── diary.md
│   ├── diagrams/       # Диаграммы
│   └── screenshots/    # Скриншоты
├── src/                # Исходный код
│   ├── data/           # Базы данных (артефакты, товары)
│   ├── entities/       # Игровые объекты
│   ├── scenes/         # Сцены (Hub, Desert, Expedition)
│   ├── systems/        # Системы (Save, Shop, LevelGenerator)
│   ├── ui/             # HUD и интерфейсы
│   └── main.ts         # Точка входа
├── tests/              # Unit-тесты
├── public/             # Статика
├── .github/workflows/  # CI
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── CHANGELOG.md
└── README.md
```