export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return value.replace("T", " ");
}


export function formatTaskType(value: string): string {
  const mapping: Record<string, string> = {
    register: "批量注册",
    login_check: "登录校验",
    token_refresh: "Token 刷新",
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
    login_failed: "登录失败",
    disabled: "禁用",
    healthy: "健康",
    unhealthy: "异常",
    unknown: "未知",
    valid: "有效",
    expired: "过期",
  };
  return mapping[value] ?? value;
}


export function compactPath(value: string, maxLength = 44): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, 16)}...${value.slice(-22)}`;
}

