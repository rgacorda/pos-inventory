export interface SessionCashier {
  id: string;
  name: string;
}

interface StoredCashiers {
  date: string;
  users: SessionCashier[];
}

const STORAGE_KEY = "posTodaysCashiers";

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function getCurrentCashier(): SessionCashier | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: string; name?: string };
    if (!user?.id) return null;
    return { id: user.id, name: user.name || "Cashier" };
  } catch {
    return null;
  }
}

export function getTodaysLoggedInCashiers(): SessionCashier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCashiers;
    if (parsed.date !== todayKey() || !Array.isArray(parsed.users)) return [];
    return parsed.users.filter((user) => user?.id && user?.name);
  } catch {
    return [];
  }
}

export function recordLoggedInCashier(user: SessionCashier) {
  if (typeof window === "undefined" || !user.id) return;
  const users = getTodaysLoggedInCashiers();
  const index = users.findIndex((existing) => existing.id === user.id);
  if (index >= 0) {
    users[index] = { id: user.id, name: user.name || users[index].name };
  } else {
    users.push({ id: user.id, name: user.name || "Cashier" });
  }
  const payload: StoredCashiers = { date: todayKey(), users };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
