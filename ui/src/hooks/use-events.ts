import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { subscribeToEvents } from "../api/client";

export function useDesktopEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void subscribeToEvents({
      account_status_changed: (payload) => {
        const accountId = Number((payload as { account_id?: number }).account_id);
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
        if (!Number.isNaN(accountId)) {
          void queryClient.invalidateQueries({ queryKey: ["account", accountId] });
        }
      },
      mail_received: (payload) => {
        const accountId = Number((payload as { account_id?: number }).account_id);
        void queryClient.invalidateQueries({ queryKey: ["messages"] });
        if (!Number.isNaN(accountId)) {
          void queryClient.invalidateQueries({ queryKey: ["account", accountId] });
        }
      }
    }).then((teardown) => {
      dispose = teardown;
    });

    return () => {
      dispose?.();
    };
  }, [queryClient]);
}
