export function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function paginationValues(limitRaw: string | null, offsetRaw: string | null) {
  const limit = Number(limitRaw ?? 100);
  const offset = Number(offsetRaw ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return null;
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) return null;
  return { limit, offset };
}
