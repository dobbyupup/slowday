export const SITE_BASE_PATH = "/rl";

export function sitePath(path: string) {
  if (!path.startsWith("/") || path === SITE_BASE_PATH || path.startsWith(`${SITE_BASE_PATH}/`)) return path;
  return `${SITE_BASE_PATH}${path}`;
}
