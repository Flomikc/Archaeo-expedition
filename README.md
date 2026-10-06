# Артефакт: Наследие (Archaeo-expedition)

Браузерная 3D-игра от первого лица об археологических экспедициях. Игрок исследует процедурно-генерируемые египетские пирамиды, добывает артефакты буром, защищает их от аномалий и реставрирует в фургоне-мастерской.

Разработка — в рамках учебной практики (ИСП 43, Сизиков Д.Д.).

![Status](https://img.shields.io/badge/version-1.0.0-blue)
![Tests](https://img.shields.io/badge/tests-28%2F28-green)
![Coverage](https://img.shields.io/badge/coverage-86.61%25-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Возможности

- Сцена-хаб (фургон) с ноутбуком, верстаком, фотоаппаратом.
- Процедурная генерация пирамиды — 3 этажа, 4×4 комнат, типология (коридор, зал, ловушка, сокровищница, колонны, лестница).
- Взлом двери — мини-игра с круговым циферблатом.
- Бур с таймером раскопок и апгрейдом скорости.
- Аномалии с AI: патрулирование → погоня → атака.
- Фотографирование аномалий через фотоаппарат.
- Реставрация артефактов — мини-игра обводки контура.
- 5 редкостей артефактов, слияние 3 → 1 следующего уровня.
- Магазин снаряжения (отмычка, автовзлом, плёнка, сверло, аптечка).
- Сохранения в `localStorage` с миграциями.
- Обработка исключений (ValidationError, ShopError, ArtifactError).

## Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Язык | TypeScript 5.5 |
| 3D-рендер | Babylon.js 7.54 |
| Сборка | Vite 4.5 |
| Тесты | Vitest 2.1 + happy-dom |
| CI | GitHub Actions |
| Хранение | localStorage |
| Node.js | 20 LTS |

## Быстрый старт

```bash
git clone https://github.com/Flomikc/Archaeo-expedition.git
cd Archaeo-expedition
npm install
npm run dev
```

Откройте в браузере: **http://localhost:5173**

> **Важно:** требуется Node.js 18+. На Node 16 проект не запустится (Vitest 2.1 не поддерживает).

## Тесты

```bash
npm test                  # однократный прогон
npm run test:coverage     # с покрытием
npm run test:watch        # в watch-режиме
```

**Текущее состояние:** 28/28 пройдено, покрытие 86.61% по бизнес-логике.

## Production-сборка

```bash
npm run build
npm run preview
```

Готовый бандл — в `dist/`. Подходит для публикации на GitHub Pages или Яндекс Играх.

## Документация

- [Руководство пользователя](docs/user-guide.md)
- [Руководство по установке](docs/install-guide.md)
- [Changelog](CHANGELOG.md)
- [Метрики качества](docs/quality-metrics.md)
- [Баг-репорты](docs/bug-reports.md)
- [Дневник практики](docs/diary.md)
- [Диаграммы](docs/diagrams/)

## Управление

| Клавиша | Действие |
|---------|----------|
| WASD | Движение |
| Мышь | Обзор |
| Shift | Бег |
| Space | Прыжок |
| E | Взаимодействие |
| F / ЛКМ | Фото |
| H | Аптечка |
| Колесо | Фонарик |
| ESC | Пауза |

## Структура

```
src/
├── data/         — артефакты, товары
├── entities/     — игровые объекты (Player, Drill, Anomaly, CameraItem)
├── scenes/       — HubScene, DesertScene, ExpeditionScene
├── systems/      — SaveSystem, ShopSystem, ArtifactSystem, LevelGenerator
├── ui/           — HUD
└── main.ts       — точка входа
```

## Известные ограничения

- Только одна локация (Египет). Остальные — в фазе 2.
- Мультиплеер не реализован.
- Размер gzip-бандла — 1.14 МБ (из-за рантайма Babylon.js).
- Мобильное управление частичное.

## Лицензия

MIT. См. [LICENSE](LICENSE).

## Автор

**Сизиков Д.Д.**, группа ИСП 43.