import type { ReviewCard } from "./types";

const STORAGE_KEY = "kairo.reviewDeck.v1";

export function loadDeck(): ReviewCard[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReviewCard[]) : [];
  } catch {
    return [];
  }
}

export function saveDeck(cards: ReviewCard[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function clearDeck(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
