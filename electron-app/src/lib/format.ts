export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ").replace("Z", "");
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(parsed)
    .replace(/\//g, "-");
}

export function compactPath(value: string, maxLength = 52): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, 18)}...${value.slice(-26)}`;
}

export function formatTaskType(value: string): string {
  const mapping: Record<string, string> = {
    register: "批量注册",
    login_check: "登录校验",
    token_refresh: "Token 刷新",
    mail_sync: "邮件同步",
  };
  return mapping[value] ?? value;
}

export function formatStatus(value: string): string {
  const mapping: Record<string, string> = {
    pending: "待执行",
    running: "执行中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
    active: "可用",
    disabled: "停用",
    healthy: "健康",
    unhealthy: "异常",
    valid: "有效",
    expired: "已过期",
    stored: "已保存",
    unknown: "未知",
  };
  return mapping[value] ?? value;
}

export function formatConnectivityStatus(value: string): string {
  const mapping: Record<string, string> = {
    connectable: "待检测",
    connected: "可同步",
    failed: "检测失败",
    action_required: "待补配置",
    disconnected: "未连接",
    unknown: "未知",
  };
  return mapping[value] ?? value;
}

export function formatMailCapability(value: string): string {
  const mapping: Record<string, string> = {
    receive_only: "可收件",
    not_ready: "未就绪",
    unknown: "未知",
  };
  return mapping[value] ?? value;
}

export function formatSource(value: string): string {
  const mapping: Record<string, string> = {
    imap: "IMAP",
    mock: "模拟",
  };
  return mapping[value] ?? value ?? "—";
}

export function formatAlertKind(value: string): string {
  const mapping: Record<string, string> = {
    error: "错误",
    warning: "提醒",
    info: "信息",
  };
  return mapping[value] ?? value;
}

export function formatBooleanText(value: boolean): string {
  return value ? "已配置" : "缺失";
}

export function getStatusTone(value: string): "neutral" | "success" | "warning" | "danger" {
  if (["completed", "active", "healthy", "valid", "stored"].includes(value)) {
    return "success";
  }
  if (["failed", "cancelled", "unhealthy", "expired", "login_failed"].includes(value)) {
    return "danger";
  }
  if (["pending", "running", "connectable", "action_required"].includes(value)) {
    return "warning";
  }
  return "neutral";
}

export function getConnectivityTone(value: string): "neutral" | "success" | "warning" | "danger" {
  if (value === "connected") {
    return "success";
  }
  if (value === "failed") {
    return "danger";
  }
  if (value === "connectable" || value === "action_required") {
    return "warning";
  }
  return "neutral";
}

export function getAlertTone(value: string): "neutral" | "success" | "warning" | "danger" {
  if (value === "error") {
    return "danger";
  }
  if (value === "warning") {
    return "warning";
  }
  return "neutral";
}
