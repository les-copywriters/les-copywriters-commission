import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe localStorage helpers — never throw (quota exceeded, private browsing, SSR). */
export const ls = {
  get: (key: string, fallback = ""): string => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* ignore quota/private-mode errors */ }
  },
};
