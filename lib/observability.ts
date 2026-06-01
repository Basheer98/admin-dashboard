type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  message: string;
  requestId?: string;
  route?: string;
  actor?: string;
  details?: Record<string, unknown>;
};

function emit(level: LogLevel, payload: LogPayload) {
  const event = {
    level,
    ts: new Date().toISOString(),
    ...payload,
  };
  const line = JSON.stringify(event);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function readRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim() ||
    crypto.randomUUID()
  );
}

export function logInfo(payload: LogPayload) {
  emit("info", payload);
}

export function logWarn(payload: LogPayload) {
  emit("warn", payload);
}

export function logError(payload: LogPayload) {
  emit("error", payload);
}
