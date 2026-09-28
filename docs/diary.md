# Дневник учебной практики

**Студент:** Сизиков Д.Д.
**Группа:** ИСП 43
**Тема:** Разработка браузерной 3D-игры об археологических экспедициях на JavaScript

---

## День 7 — 28.09.2026

**Отработано:** 6 часов 30 минут

### Что сделано

**1. Анализ исключительных ситуаций (1 час)**

Составлена таблица из 10 ситуаций в `docs/exceptions.md`. Классификация по приоритетам: критические / важные / желательные. Определены три стратегии обработки: Fail fast, Graceful degradation, Fallback.

**2. Классы исключений (50 минут)**

Создан `src/systems/errors.ts`. Иерархия: `GameError` → `SaveError`, `ValidationError`, `ShopError`, `ArtifactError`, `GenerationError`. Добавлены утилиты `safeJsonParse`, `isValidString`, `isValidPositiveNumber`.

**3. Интеграция в системы (2 часа)**

- `ShopSystem` — реально бросает `ValidationError` (пустой id), `ShopError` (id есть, товара нет).
- `ArtifactSystem` — реально бросает `ArtifactError` (некорректный индекс, неизвестный артефакт).
- `SaveSystem` — `try/catch` + graceful degradation при переполнении localStorage.
- Бизнес-отказы (мало монет, лимит) возвращаются как `{ ok: false, reason }`, не как исключения.

**4. Тестирование 10 сценариев (1 час)**

Каждый сценарий проверен вручную. Результаты занесены в таблицу `docs/debug-report.md`. Сделаны скриншоты 06–09.

**5. Обновление диаграмм (50 минут)**

- Activity Diagram — `docs/diagrams/activity-exception.md`.
- State Machine — `docs/diagrams/state-anomaly.md`.
- Component Diagram — `docs/diagrams/component-updated.md`.

**6. Взаимное ревью (40 минут)**

5 комментариев в `docs/review-day7.md`. По итогам ревью запланированы 3 улучшения на фазу 2.

### Проблемы

- `SaveError` объявлен, но не используется в коде — оставлен как задел под облачные сохранения (SDK). Это явно указано в документации.
- Разделение ошибок на `throw` и `return reason` потребовало переписывания части методов `ShopSystem` и `ArtifactSystem`.

### Планы на следующий день

- Рефакторинг `ExpeditionScene.update()`.
- Интеграция SDK Яндекс Игр.
- Черновики unit-тестов.