import type { AppView } from "../types";

export const NAV_ITEMS: Array<{ id: AppView; label: string; caption: string }> = [
  { id: "dashboard", label: "仪表盘", caption: "总览与提醒" },
  { id: "register", label: "批量注册", caption: "任务配置与批次" },
  { id: "accounts", label: "账号中心", caption: "批量运营工作台" },
  { id: "mail", label: "邮件中心", caption: "同步与预览" },
  { id: "settings", label: "系统设置", caption: "运行环境与策略" },
];

export const VIEW_META: Record<AppView, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "Workspace",
    title: "运营总览",
    description: "用一眼能看懂的方式聚合账号池、邮件同步和系统提醒，方便从全局判断下一步应该处理什么。",
  },
  register: {
    eyebrow: "Register",
    title: "批量注册",
    description: "集中配置注册参数、查看批次表现与错误日志，让注册任务的启动和复盘都更轻松。",
  },
  accounts: {
    eyebrow: "Accounts",
    title: "账号中心",
    description: "围绕导入、补凭证、检测、同步与删除重组信息结构，让批量运营更清楚、更顺手。",
  },
  mail: {
    eyebrow: "Mailbox",
    title: "邮件中心",
    description: "把同步态势、邮件列表和详情预览放进同一个工作台，在查看与处理之间无缝切换。",
  },
  settings: {
    eyebrow: "Settings",
    title: "系统设置",
    description: "统一配置 OAuth、IMAP、轮询策略与代理池，让桌面端运行状态更可控。",
  },
};
