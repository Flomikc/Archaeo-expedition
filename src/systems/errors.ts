/**
 * Иерархия игровых исключений.
 *
 * ВАЖНО: не все ошибки — исключения. Ожидаемые бизнес-отказы
 * (мало монет, лимит покупок) возвращаются как { ok: false, reason }.
 * Исключения бросаются только для:
 *   • программных ошибок (некорректный ID, индекс);
 *   • системных сбоев (переполнение localStorage);
 *   • несогласованности данных (ID есть, предмета нет).
 *
 * Реальное использование классов:
 *   • ValidationError — ShopSystem.buy (пустой id), canBuy (некорректный item)
 *   • ShopError       — ShopSystem.buy (id есть, товара нет)
 *   • ArtifactError   — ArtifactSystem.getPrice / mergeFirstOfKind (плохой индекс)
 *   • SaveError       — зарезервирован для будущих облачных сохранений (SDK)
 *   • GenerationError — зарезервирован для фазы 2
 */

export class GameError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown>;
  
    constructor(message: string, code: string, context?: Record<string, unknown>) {
      super(message);
      this.name = "GameError";
      this.code = code;
      this.context = context;
    }
  }
  
  /** Ошибки сохранений (localStorage, миграции, повреждённые данные). */
  export class SaveError extends GameError {
    constructor(message: string, context?: Record<string, unknown>) {
      super(message, "SAVE_ERROR", context);
      this.name = "SaveError";
    }
  }
  
  /** Ошибки валидации пользовательского ввода. */
  export class ValidationError extends GameError {
    constructor(message: string, context?: Record<string, unknown>) {
      super(message, "VALIDATION_ERROR", context);
      this.name = "ValidationError";
    }
  }
  
  /** Ошибки магазина (покупка, списание, лимиты). */
  export class ShopError extends GameError {
    constructor(message: string, context?: Record<string, unknown>) {
      super(message, "SHOP_ERROR", context);
      this.name = "ShopError";
    }
  }
  
  /** Ошибки работы с артефактами (слияние, продажа, поиск). */
  export class ArtifactError extends GameError {
    constructor(message: string, context?: Record<string, unknown>) {
      super(message, "ARTIFACT_ERROR", context);
      this.name = "ArtifactError";
    }
  }
  
  /** Ошибки процедурной генерации уровня. */
  export class GenerationError extends GameError {
    constructor(message: string, context?: Record<string, unknown>) {
      super(message, "GENERATION_ERROR", context);
      this.name = "GenerationError";
    }
  }
  
  /** Утилита: безопасный парсинг JSON. */
  export function safeJsonParse<T>(raw: string, fallback: T): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  
  /** Утилита: проверить, что значение — непустая строка. */
  export function isValidString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
  }
  
  /** Утилита: проверить, что значение — положительное число. */
  export function isValidPositiveNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }