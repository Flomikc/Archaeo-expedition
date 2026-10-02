# Отчёт о покрытии тестами

**Дата:** 02.10.2026
**Студент:** Сизиков Д.Д., ИСП 43
**Раннер:** Vitest 2.1 + @vitest/coverage-v8
**Окружение:** happy-dom

## Покрытые функции

| Функция / Модуль | Файл | Кол-во тестов | Статус |
|------------------|------|---------------|--------|
| SaveSystem.get | `src/systems/SaveSystem.ts` | 8 | ✅ |
| ShopSystem.buy | `src/systems/ShopSystem.ts` | 7 | ✅ |
| ArtifactSystem.getPrice / merge | `src/systems/ArtifactSystem.ts` | 6 | ✅ |
| LevelGenerator.build | `src/systems/LevelGenerator.ts` | 3 | ✅ |
| Performance (Save/Artifact/Level) | `tests/performance.test.ts` | 4 | ✅ |
| **Итого** | | **28** | **✅ 28/28** |

## Непокрытые функции

| Функция | Причина |
|---------|---------|
| `InteractionSystem.update` | Raycast — тестируется вручную в браузере |
| `Atmosphere.apply` | Постобработка — визуальный эффект |
| `HUD.renderShop` | DOM-манипуляции — ручное тестирование |
| `LockpickSystem` | Мини-игра — интеграционное покрытие в фазе 2 |
| `WorkbenchSystem` | Мини-игра — покрытие в фазе 2 |

## Оценка покрытия

| Категория | Покрытие |
|-----------|----------|
| Критические модули (SaveSystem, ShopSystem, ArtifactSystem) | **100%** |
| Генерация уровней | **80%** |
| Все системы в целом | **~78%** |
| UI и визуал | **0%** (ручное) |

Целевой показатель ≥ 70% — **достигнут**.

## Результаты прогона

Test Files 5 passed (5)
Tests 28 passed (28)
Duration 4.82s

text

## Вывод

Все критические бизнес-функции покрыты unit-тестами. UI и визуальные эффекты тестируются вручную. Performance-тесты подтверждают отсутствие деградации на объёмах в 500–1000 операций.