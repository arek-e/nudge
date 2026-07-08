const devLogName = "dev.log";

export function devLogTimestamp(date: Date) {
  return date
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
}

export function devLogDir(repoRoot: string, date = new Date()) {
  return `${withoutTrailingSlash(repoRoot)}/tmp/logs/${devLogTimestamp(date)}`;
}

export function latestDevLogDir(repoRoot: string) {
  return `${withoutTrailingSlash(repoRoot)}/tmp/logs/latest`;
}

export function devLogFile(logDir: string) {
  return `${withoutTrailingSlash(logDir)}/${devLogName}`;
}

function withoutTrailingSlash(path: string) {
  return path.replace(/\/+$/, "");
}
