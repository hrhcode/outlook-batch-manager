type StatusPillProps = {
  value: string;
};

const STATUS_LABELS: Record<string, string> = {
  untested: "未测试",
  success: "成功",
  failed: "失败",
  idle: "空闲",
  active: "运行中",
  polling: "轮询中",
  disconnected: "未联通",
  connecting: "联通中",
  connected: "已联通"
};

export function StatusPill({ value }: StatusPillProps) {
  const label = STATUS_LABELS[value] ?? value;
  return (
    <span aria-label={`状态：${label}`} className={`status-pill status-${value}`}>
      {label}
    </span>
  );
}
