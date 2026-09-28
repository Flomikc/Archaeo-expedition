# Архитектура проекта

## Сцены

- `HubScene` — фургон-хаб (ноутбук, верстак, фотоаппарат).
- `DesertScene` — пустыня у пирамиды.
- `ExpeditionScene` — процедурная пирамида.

## Системы

- `GameManager` — переключение сцен.
- `LevelGenerator` — процедурная генерация.
- `SaveSystem` — сохранения (localStorage).
- `ShopSystem` — покупки, бонусы.
- `ArtifactSystem` — продажа, слияние.
- `WorkbenchSystem` — мини-игра реставрации.
- `LockpickSystem` — мини-игра взлома.
- `InteractionSystem` — raycast-взаимодействие.
- `AnomalyAI` — state machine аномалий.
- `LaptopSystem` — подлёт камеры к ноутбуку.
- `Atmosphere` — постобработка, частицы.
- `HUD` — HTML-оверлей.

## Поток данных

Главный цикл → Сцены → Механики → SaveSystem
