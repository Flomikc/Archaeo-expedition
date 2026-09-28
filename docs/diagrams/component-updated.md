## 📄 Часть 5. Создай `docs/diagrams/component-updated.md`

Component Diagram с `errors.ts`.

```markdown
# Component Diagram (обновлён под день 7)

```mermaid
flowchart LR
    subgraph Core["Ядро (core)"]
        GM[GameManager<br/>main.ts]
        ERR[errors.ts<br/>GameError + 5 классов]
    end

    subgraph Systems["Системы (systems)"]
        SAVE[SaveSystem]
        SHOP[ShopSystem]
        ART[ArtifactSystem]
        GEN[LevelGenerator]
        INV[InteractionSystem]
        LOCK[LockpickSystem]
        WORK[WorkbenchSystem]
    end

    subgraph Scenes["Сцены (scenes)"]
        HUB[HubScene]
        DES[DesertScene]
        EXP[ExpeditionScene]
    end

    subgraph UI["UI"]
        HUD[HUD]
        LAP[LaptopSystem]
    end

    subgraph Data["Данные"]
        LS[(localStorage)]
        JSON[data/*.json]
    end

    GM --> HUB
    GM --> DES
    GM --> EXP

    HUB --> SAVE
    HUB --> SHOP
    HUB --> ART
    HUB --> WORK
    HUB --> LAP

    DES --> SAVE
    DES --> LOCK

    EXP --> SAVE
    EXP --> ART
    EXP --> GEN
    EXP --> INV

    SAVE --> LS
    SAVE --> ERR
    SHOP --> ERR
    ART --> ERR
    GEN --> ERR

    SAVE --> JSON
    SHOP --> JSON
    ART --> JSON

    HUD -.отображает.-> HUB
    HUD -.отображает.-> EXP
```

## Что нового

- **`errors.ts`** вынесен как отдельный компонент ядра.
- **Все системы** зависят от `errors.ts`, но используют разные классы:
  - `ShopSystem` → `ValidationError`, `ShopError`
  - `ArtifactSystem` → `ArtifactError`
  - `SaveSystem`, `LevelGenerator` → пока не используют, зависимость зарезервирована