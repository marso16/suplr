import { useEffect, useRef } from "react";
import type { SSEOrderEvent } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useOrderWS(onEvent: (event: SSEOrderEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 1000;
    let dead = false;

    function connect() {
      if (dead) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      es = new EventSource(
        `${API_BASE}/sse/orders?token=${encodeURIComponent(token)}`,
      );

      es.onopen = () => {
        retryDelay = 1000;
      };

      es.onmessage = (e) => {
        try {
          const data: SSEOrderEvent = JSON.parse(e.data);
          onEventRef.current(data);
        } catch {}
      };

      es.onerror = () => {
        if (dead) return;
        es?.close();
        retryTimeout = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    }

    connect();

    return () => {
      dead = true;
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);
}
