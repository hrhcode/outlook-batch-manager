import { useEffect, useState } from "react";

type CopyableSecretProps = {
  value: string | null;
  emptyLabel?: string;
  ariaLabel: string;
};

export function CopyableSecret({ value, emptyLabel = "--", ariaLabel }: CopyableSecretProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(secret: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(secret);
      return;
    }

    const input = document.createElement("textarea");
    input.value = secret;
    input.setAttribute("readonly", "true");
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!value) {
    return <span className="value-empty">{emptyLabel}</span>;
  }

  return (
    <div className="copyable-secret">
      <code className="secret-value" title={value}>
        {value}
      </code>
      <button
        aria-label={ariaLabel}
        className="copy-button"
        onClick={async () => {
          await handleCopy(value);
          setCopied(true);
        }}
        type="button"
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
