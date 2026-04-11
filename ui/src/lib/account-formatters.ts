const BEIJING_TIMEZONE = "Asia/Shanghai";

function parseApiDate(value: string) {
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  return new Date(normalized);
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const dateText = date.toLocaleDateString("zh-CN", { timeZone: BEIJING_TIMEZONE });
  const timeText = date.toLocaleTimeString("zh-CN", {
    timeZone: BEIJING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${dateText} ${timeText}`;
}

export function formatPreciseDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("zh-CN", { timeZone: BEIJING_TIMEZONE });
}

export function formatSyncMode(value: string | null | undefined) {
  if (value === "idle") {
    return "IDLE";
  }
  if (value === "poll") {
    return "轮询";
  }
  return "--";
}

export function describeSyncMode(value: string | null | undefined) {
  if (value === "idle") {
    return "当前账号使用 IDLE 长连接接收邮件。";
  }
  if (value === "poll") {
    return "当前账号使用轮询模式接收邮件。";
  }
  return "当前账号暂未形成同步模式。";
}

export function formatMailRecipients(value: string | null | undefined) {
  if (!value) {
    return "未记录收件人";
  }

  return value;
}
