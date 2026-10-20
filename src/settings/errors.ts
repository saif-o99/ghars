/** A translated message, with the technical detail after it. */
export function withDetail(message: string, e: unknown): string {
  const detail = e instanceof Error ? e.message : e == null ? "" : String(e);
  return detail ? `${message} (${detail})` : message;
}
