const STORAGE_KEY = "bookar-pending-explicador-room";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PendingExplicadorRoom {
  path: string;
  savedAt: number;
}

const EXPLICADOR_ROOM_PATH = /^\/app\/explicador\/[^/]+$/;

export function isExplicadorRoomPath(path: string): boolean {
  return EXPLICADOR_ROOM_PATH.test(path);
}

export function savePendingExplicadorRoom(path: string): void {
  if (typeof window === "undefined" || !isExplicadorRoomPath(path.split("?")[0])) return;

  const payload: PendingExplicadorRoom = {
    path,
    savedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getPendingExplicadorRoom(): PendingExplicadorRoom | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingExplicadorRoom;
    if (!parsed?.path || !isExplicadorRoomPath(parsed.path.split("?")[0])) {
      clearPendingExplicadorRoom();
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearPendingExplicadorRoom();
      return null;
    }

    return parsed;
  } catch {
    clearPendingExplicadorRoom();
    return null;
  }
}

export function clearPendingExplicadorRoom(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getExplicadorRoomIdFromPath(path: string): string | null {
  const pathname = path.split("?")[0];
  const match = pathname.match(/^\/app\/explicador\/([^/]+)$/);
  return match?.[1] ?? null;
}
