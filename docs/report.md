# Дневник учебной практики

**Студент:** Сизиков Д.Д.
**Группа:** ИСП 43
**Тема:** Разработка браузерной 3D-игры об археологических экспедициях на JavaScript

## День 4 - 24.09.2026

### Цель дня

Перейти от проектирования к реализации. Создать структуру проекта, настроить стандарты кодирования, зафиксировать первые программные модули в Git.

### Выполненная работа

**1. Структура проекта**

Создана полная структура папок в репозитории:
Archaeo-expedition/
├── docs/
│ ├── coding-standards.md
│ ├── architecture.md
│ ├── report.md
│ ├── review.md
│ └── diagrams/
├── data/
│ └── objects.json
├── tests/
│ └── README.md
├── src/
│ ├── data/
│ ├── entities/
│ ├── scenes/
│ ├── systems/
│ ├── ui/
│ └── main.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .editorconfig
├── .gitignore
└── README.md

**2. Стандарты кодирования**

Создан файл `.editorconfig` со следующими настройками:
- Кодировка UTF-8.
- Отступ — 2 пробела.
- Перевод строки LF.
- Финальная пустая строка обязательна.
- Удаление висячих пробелов.

Создан `.gitignore` — исключены `node_modules/`, `dist/`, `.vscode/`, `*.log`.

Создан `docs/coding-standards.md` с зафиксированными соглашениями:

| Элемент | Стиль | Пример |
|---------|-------|--------|
| Переменные | camelCase | `playerPosition`, `drillProgress` |
| Константы | UPPER_SNAKE_CASE | `MISSION_TIME`, `MAX_ANOMALIES` |
| Функции | camelCase | `spawnAnomaly()`, `takePhoto()` |
| Классы | PascalCase | `ExpeditionScene`, `Anomaly` |
| Интерфейсы | PascalCase | `AnomalyOptions`, `SaveData` |
| Файлы классов | PascalCase.ts | `ExpeditionScene.ts` |

**3. Реализованные модули**

Реализованы и зафиксированы в Git ключевые модули проекта:

- `src/systems/SaveSystem.ts` — система сохранений с миграциями и валидацией данных.
- `src/systems/LevelGenerator.ts` — процедурный генератор уровней (алгоритм random walk, seed, многоэтажность).
- `src/systems/ShopSystem.ts` — логика магазина: покупки, лимиты, применение бонусов.
- `src/systems/ArtifactSystem.ts` — продажа и слияние артефактов.
- `src/data/ArtifactsData.ts` — база данных артефактов с пятью редкостями.
- `src/data/ShopData.ts` — база товаров магазина.

Все модули соблюдают стандарты кодирования, содержат JSDoc-комментарии для публичных методов.

**4. Работа с Git**

Создана feature-ветка `feature/docs-finalize` для оформления структуры проекта. Внесены осмысленные изменения, ветка слита в `main`.

История коммитов (за день):
git add .editorconfig .gitignore
git commit -m "Добавлены .editorconfig и .gitignore"

git add docs/
git commit -m "Добавлена документация: стандарты кодирования и архитектура"

git add src/systems/SaveSystem.ts
git commit -m "Реализован модуль сохранений (SaveSystem)"

git add src/systems/LevelGenerator.ts src/data/RoomTemplates.ts
git commit -m "Реализован процедурный генератор уровней"

git add src/systems/ShopSystem.ts src/data/ShopData.ts
git commit -m "Реализован модуль магазина (ShopSystem)"

git commit -m "Удалена дублирующаяся папка diagrams"

git commit -m "Дополнены стандарты: правила комментариев"

Все коммиты отправлены в удалённый репозиторий GitHub.

**5. Код-ревью**

Проведена саморецензия кода, результаты зафиксированы в `docs/review.md`:

*Что реализовано хорошо:*
- Чёткое разделение на сцены и системы.
- Все игровые параметры вынесены в константы.
- Сохранения централизованы в `SaveSystem`.

*Что можно улучшить:*
- Метод `ExpeditionScene.update()` слишком длинный (70 строк) — стоит разбить на подметоды.
- Дублирование логики raycast в `InteractionSystem` и `ExpeditionScene`.
- Не все публичные методы имеют JSDoc-комментарии.

### Возникшие проблемы

**Проблема:** При клонировании приватного репозитория GitHub возникла ошибка 403 (Write access not granted) при использовании fine-grained токена.

**Причина:** Fine-grained токены требуют явного указания прав на конкретный репозиторий. Стандартная галочка `repo`, к которой я привык, есть только у classic-токенов.

**Решение:** Создан classic Personal Access Token с scope `repo`. Клонирование прошло успешно. Токен добавлен в remote URL, после клонирования заменён на чистый адрес во избежание утечки.
