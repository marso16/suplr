import { useEffect, useRef } from "react";
import type { SSEOrderEvent } from "@/types";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /^http/,
  "ws"
);

export function useOrderWS(onEvent: (event: SSEOrderEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 1000;
    let dead = false;

    function connect() {
      if (dead) return;

      const token = localStorage.getItem("token");
      if (!token) return;

      ws = new WebSocket(`${WS_BASE}/ws/orders?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        retryDelay = 1000;
      };

      ws.onmessage = (e) => {
        try {
          const data: SSEOrderEvent = JSON.parse(e.data);
          onEventRef.current(data);
        } catch {}
      };

      ws.onclose = (e) => {
        if (dead) return;
        if (e.code === 4001) return; 
        retryTimeout = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    }

    connect();

    return () => {
      dead = true;
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, []);
}
