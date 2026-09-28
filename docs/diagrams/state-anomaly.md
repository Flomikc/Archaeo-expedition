# State Machine: Аномалия

```mermaid
stateDiagram-v2
    [*] --> Patrol: Спавн на этаже

    Patrol --> Chase: Игрок в радиусе 9 м<br/>И на том же этаже
    Chase --> Patrol: Игрок дальше 13 м<br/>ИЛИ игрок на другом этаже

    Chase --> Attack: Расстояние < 1.7 м<br/>И кулдаун истёк
    Attack --> Patrol: Урон нанесён<br/>Установка кулдауна

    Patrol --> Error: Некорректная точка<br/>патруля (NaN)
    Error --> Patrol: Fallback на центр<br/>текущего этажа

    Chase --> Disposed: Фотография<br/>от игрока
    Patrol --> Disposed: Фотография<br/>от игрока
    Attack --> Disposed: Фотография<br/>от игрока

    Disposed --> [*]