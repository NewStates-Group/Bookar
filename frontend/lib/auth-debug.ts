const enabled =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_AUTH_DEBUG === "true";

/** Logs de refresh JWT — consola do browser e terminal do container frontend. */
export function authDebug(message: string, detail?: Record<string, unknown>) {
  if (!enabled) return;
  const label = "[Bookar Auth]";
  if (detail) {
    console.log(label, message, detail);
  } else {
    console.log(label, message);
  }
}
