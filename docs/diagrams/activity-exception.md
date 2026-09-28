# Activity Diagram: Полный игровой цикл с обработкой ошибок

## Описание

Диаграмма показывает основной поток игрока от старта до завершения экспедиции,
с точками ветвления, где возможны ошибки и как они обрабатываются.

```mermaid
flowchart TD
    Start([Старт игры]) --> Load{Загрузка<br/>сохранения}
    Load -- "JSON повреждён" --> Fallback[Fallback: emptySave<br/>SaveError не бросается]
    Load -- OK --> Hub[Сцена: Фургон]

    Fallback --> Hub
    Hub --> OpenLaptop{Игрок открывает<br/>ноутбук}
    OpenLaptop -- "E на ноутбуке" --> Shop[Вкладка магазина]

    Shop --> BuyAttempt{Покупка}
    BuyAttempt -- "id пустой" --> VErr[throw ValidationError]
    BuyAttempt -- "id есть, товара нет" --> SErr[throw ShopError]
    BuyAttempt -- "монет мало / лимит" --> BReason[return ok:false, reason]
    BuyAttempt -- OK --> BuyOK[Списать монеты, выдать предмет]

    VErr --> Catch[catch в HUD]
    SErr --> Catch
    Catch --> Log[console.error с префиксом<br/>класс.метод]
    Log --> Hub

    BReason --> Toast[Тост пользователю]
    BuyOK --> Toast
    Toast --> Hub

    Hub --> Expedition[Сцена: Пирамида]
    Expedition --> FindDrill{Найти бур}
    FindDrill -- "E на буре" --> Drilling[Раскопки 3 мин]
    FindDrill -- "нет бура" --> Lost[Заблудился<br/>ничего не происходит]

    Drilling --> Photo{Фото аномалии}
    Photo -- "нет камеры" --> NoCam[Тост: Нет фотоаппарата]
    Photo -- "плёно нет" --> NoFilm[Тост: Плёнка закончилась]
    Photo -- OK --> AnomalyGone[Аномалия исчезает]

    NoCam --> Drilling
    NoFilm --> Drilling
    AnomalyGone --> Drilling

    Drilling --> Done{Бур завершён}
    Done -- Да --> Return[Возврат ко входу]
    Return --> End([Вердикт миссии])
    Done -- "Время вышло" --> Fail([Провал экспедиции])

    Fail --> Hub