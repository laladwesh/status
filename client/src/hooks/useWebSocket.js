import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../utils/auth';

export function useWebSocket(enabled = true) {
  const [metrics, setMetrics] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'development' ? 'localhost:5047' : window.location.host;
    const ws = new WebSocket(`${proto}//${host}?token=${encodeURIComponent(token)}`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); timerRef.current = setTimeout(connect, 4000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try { const msg = JSON.parse(e.data); if (msg.type === 'metrics') setMetrics(msg.data); } catch {}
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => { clearTimeout(timerRef.current); wsRef.current?.close(); };
  }, [connect, enabled]);

  return { metrics, connected };
}
