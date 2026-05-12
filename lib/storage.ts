import type { DeckStore } from "./review-session";
import type { ReviewCard } from "./types";

const STORAGE_KEY = "kairo.reviewDeck.v1";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function createBrowserDeckStore(storage: StorageLike): DeckStore {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ReviewCard[]) : [];
      } catch {
        return [];
      }
    },
    save(cards) {
      storage.setItem(STORAGE_KEY, JSON.stringify(cards));
    },
    clear() {
      storage.removeItem(STORAGE_KEY);
    }
  };
}

export function loadDeck(): ReviewCard[] {
  if (typeof window === "undefined") return [];
  return createBrowserDeckStore(window.localStorage).load();
}

export function saveDeck(cards: ReviewCard[]): void {
  createBrowserDeckStore(window.localStorage).save(cards);
}

export function clearDeck(): void {
  if (typeof window === "undefined") return;
  createBrowserDeckStore(window.localStorage).clear();
}

export function browserDeckStore(): DeckStore {
  if (typeof window === "undefined") {
    return {
      load: () => [],
      save: () => undefined,
      clear: () => undefined
    };
  }

  return createBrowserDeckStore(window.localStorage);
}
