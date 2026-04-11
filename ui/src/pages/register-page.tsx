import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOAuth2Settings,
  updateOAuth2Settings,
  startRegisterTask,
  cancelRegisterTask,
} from "../api/client";
import { RegisterTaskPanel } from "../components/register-task-panel";
import { OAuth2ConfigPanel } from "../components/oauth2-config-panel";
import { ProxyConfigPanel } from "../components/proxy-config-panel";
import { AdvancedConfigPanel } from "../components/advanced-config-panel";
import type { OAuth2Settings, RegisterConfig } from "../types/api";

const DEFAULT_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
];

const DEFAULT_REGISTER_CONFIG: RegisterConfig = {
  browser: "patchright",
  concurrent_flows: 5,
  max_tasks: 10,
  bot_protection_wait: 11,
  max_captcha_retries: 2,
  enable_oauth2: false,
};

export function RegisterPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("task");

  // OAuth2配置状态
  const [oauth2Form, setOauth2Form] = useState<OAuth2Settings>({
    client_id: "",
    redirect_url: "",
    scopes: DEFAULT_SCOPES,
  });
  const [oauth2Loaded, setOauth2Loaded] = useState(false);

  // 注册配置状态
  const [registerConfig, setRegisterConfig] = useState<RegisterConfig>(
    DEFAULT_REGISTER_CONFIG
  );

  // 当前任务状态
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // 加载OAuth2设置
  const oauth2Query = useQuery({
    queryKey: ["oauth2-settings"],
    queryFn: getOAuth2Settings,
  });

  if (oauth2Query.data && !oauth2Loaded) {
    setOauth2Form(oauth2Query.data);
    setOauth2Loaded(true);
  }

  // 保存OAuth2设置
  const updateOauth2Mutation = useMutation({
    mutationFn: updateOAuth2Settings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oauth2-settings"] });
    },
  });

  // 开始注册任务
  const startTaskMutation = useMutation({
    mutationFn: startRegisterTask,
    onSuccess: (data) => {
      setCurrentTaskId(data.id);
      setIsRegistering(true);
    },
  });

  // 取消注册任务
  const cancelTaskMutation = useMutation({
    mutationFn: cancelRegisterTask,
    onSuccess: () => {
      setIsRegistering(false);
    },
  });

  const handleSaveOAuth2 = async () => {
    await updateOauth2Mutation.mutateAsync(oauth2Form);
  };

  const handleStartRegister = async () => {
    if (currentTaskId && isRegistering) {
      // 如果正在注册，则取消
      await cancelTaskMutation.mutateAsync(currentTaskId);
    } else {
      // 开始新任务
      await startTaskMutation.mutateAsync({
        config: registerConfig,
      });
    }
  };

  const handleRegisterComplete = () => {
    setIsRegistering(false);
    setCurrentTaskId(null);
  };

  return (
    <section className="page register-page">
      <div className="register-tabs">
        <div className="tabs-header">
          <button
            className={`tab-button ${activeTab === "task" ? "active" : ""}`}
            onClick={() => setActiveTab("task")}
            type="button"
          >
            注册任务
          </button>
          <button
            className={`tab-button ${activeTab === "oauth2" ? "active" : ""}`}
            onClick={() => setActiveTab("oauth2")}
            type="button"
          >
            OAuth2配置
          </button>
          <button
            className={`tab-button ${activeTab === "proxy" ? "active" : ""}`}
            onClick={() => setActiveTab("proxy")}
            type="button"
          >
            代理池管理
          </button>
          <button
            className={`tab-button ${activeTab === "advanced" ? "active" : ""}`}
            onClick={() => setActiveTab("advanced")}
            type="button"
          >
            高级设置
          </button>
        </div>

        <div className="tabs-content">
          {activeTab === "task" && (
            <RegisterTaskPanel
              config={registerConfig}
              onConfigChange={setRegisterConfig}
              isRegistering={isRegistering}
              taskId={currentTaskId}
              onStart={handleStartRegister}
              onComplete={handleRegisterComplete}
            />
          )}

          {activeTab === "oauth2" && (
            <OAuth2ConfigPanel
              form={oauth2Form}
              onChange={setOauth2Form}
              onSave={handleSaveOAuth2}
              isSaving={updateOauth2Mutation.isPending}
              saveSuccess={updateOauth2Mutation.isSuccess}
              saveError={updateOauth2Mutation.error}
            />
          )}

          {activeTab === "proxy" && <ProxyConfigPanel />}

          {activeTab === "advanced" && (
            <AdvancedConfigPanel
              config={registerConfig}
              onChange={setRegisterConfig}
            />
          )}
        </div>
      </div>
    </section>
  );
}
