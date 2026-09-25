# Стандарты кодирования

## Именование

| Элемент | Стиль | Пример |
|---------|-------|--------|
| Переменные | camelCase | `playerPosition`, `drillProgress` |
| Константы | UPPER_SNAKE_CASE | `MISSION_TIME`, `MAX_ANOMALIES` |
| Функции | camelCase | `spawnAnomaly()`, `takePhoto()` |
| Классы | PascalCase | `ExpeditionScene`, `Anomaly` |
| Интерфейсы | PascalCase | `AnomalyOptions`, `SaveData` |
| Файлы классов | PascalCase.ts | `ExpeditionScene.ts` |
| Файлы утилит | kebab-case.ts | `save-system.ts` |
| Папки | kebab-case | `scenes/`, `systems/` |

## Форматирование

- Отступ: 2 пробела.
- Точка с запятой: обязательна.
- Кавычки: двойные (`"`) для строк.
- Длина строки: до 100 символов.

## Комментарии

- Все публичные методы класса — JSDoc-комментарий.
- Сложные алгоритмы — построчный комментарий.
- Не комментировать очевидное.

## Архитектура

- Один файл = одна ответственность.
- Классы-сцены не знают друг о друге — переключение через `main.ts`.
- Вся работа с сохранениями — только через `SaveSystem`.
