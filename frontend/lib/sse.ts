import { useEffect, useRef } from "react";
import type { SSEOrderEvent } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useOrderSSE(onEvent: (event: SSEOrderEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const url = new URL(`${BASE}/sse/orders`);
    url.searchParams.set("token", token);
    const es = new EventSource(url.toString());

    es.onmessage = (e) => {
      try {
        const data: SSEOrderEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {}
    };

    return () => es.close();
  }, []);
}
