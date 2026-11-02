export function sanitizeInsertPayload<T extends Record<string, unknown>>(
  payload: T
): Record<string, unknown> {
  const sanitized = { ...payload };
  const { id } = sanitized;

  if (id === null || id === undefined || id === "") {
    delete sanitized.id;
  }

  return sanitized;
}
