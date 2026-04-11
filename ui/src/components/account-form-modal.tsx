import { useEffect, useMemo, useRef, useState } from "react";

type AccountFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { email: string; password: string; client_id: string; refresh_token: string }) => Promise<void>;
};

const EMPTY_FORM = {
  email: "",
  password: "",
  client_id: "",
  refresh_token: ""
};

export function AccountFormModal({ open, onClose, onSubmit }: AccountFormModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<keyof typeof EMPTY_FORM, boolean>>({
    email: false,
    password: false,
    client_id: false,
    refresh_token: false
  });
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const errors = useMemo(
    () => ({
      email: form.email.trim() ? "" : "请输入邮箱。",
      password: form.password.trim() ? "" : "请输入密码。",
      client_id: form.client_id.trim() ? "" : "请输入 client_id。",
      refresh_token: form.refresh_token.trim() ? "" : "请输入 refresh_token。"
    }),
    [form]
  );

  const hasErrors = Object.values(errors).some(Boolean);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className="panel modal-card">
        <div className="modal-header">
          <div className="label-stack">
            <p className="eyebrow">手动新增</p>
            <h3>新增账号</h3>
            <p className="field-hint">请填写账号凭据。保存后可在账号池中立即发起联通测试。</p>
          </div>
          <button aria-label="关闭新增账号弹窗" className="ghost-button dialog-close" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">
              邮箱
              <span className="field-required">*</span>
            </span>
            <input
              className="text-input"
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              ref={firstInputRef}
              value={form.email}
            />
            {touched.email && errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>

          <label>
            <span className="field-label">
              密码
              <span className="field-required">*</span>
            </span>
            <input
              className="text-input"
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              value={form.password}
            />
            {touched.password && errors.password ? <span className="field-error">{errors.password}</span> : null}
          </label>

          <label>
            <span className="field-label">
              client_id
              <span className="field-required">*</span>
            </span>
            <input
              className="text-input"
              onBlur={() => setTouched((current) => ({ ...current, client_id: true }))}
              onChange={(event) => setForm({ ...form, client_id: event.target.value })}
              value={form.client_id}
            />
            {touched.client_id && errors.client_id ? <span className="field-error">{errors.client_id}</span> : null}
          </label>

          <label>
            <span className="field-label">
              refresh_token
              <span className="field-required">*</span>
            </span>
            <textarea
              className="text-area"
              onBlur={() => setTouched((current) => ({ ...current, refresh_token: true }))}
              onChange={(event) => setForm({ ...form, refresh_token: event.target.value })}
              rows={5}
              value={form.refresh_token}
            />
            {touched.refresh_token && errors.refresh_token ? (
              <span className="field-error">{errors.refresh_token}</span>
            ) : null}
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            取消
          </button>
          <button
            className="primary-button"
            disabled={submitting || hasErrors}
            onClick={async () => {
              setTouched({
                email: true,
                password: true,
                client_id: true,
                refresh_token: true
              });
              if (hasErrors) {
                return;
              }
              setSubmitting(true);
              try {
                await onSubmit(form);
                setForm(EMPTY_FORM);
                setTouched({
                  email: false,
                  password: false,
                  client_id: false,
                  refresh_token: false
                });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            type="button"
          >
            {submitting ? "保存中..." : "保存账号"}
          </button>
        </div>
      </div>
    </div>
  );
}
