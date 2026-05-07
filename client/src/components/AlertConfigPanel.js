import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

const AlertConfigPanel = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/admin/alerts/status')
      .then((res) => { if (!cancelled) setStatus(res.data); })
      .catch(() => { if (!cancelled) setStatus({ email: false, cooldownMinutes: 0 }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timerRef.current); };
  }, []);

  const showMessage = (kind, text) => {
    setMessage({ kind, text });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  };

  const sendTest = async () => {
    try {
      await apiClient.post('/admin/alerts/test');
      showMessage('success', '✅ Alert sent!');
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to send alert');
    }
  };

  if (loading) return <div className="bg-white border border-[#d9dde2] rounded-md p-4 h-32 animate-pulse" />;

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <h3 className="text-sm font-semibold text-[#2c3138] mb-3">Alerts</h3>
      <div className="space-y-1 text-sm">
        <div>Email: {status?.email ? '✅ Configured' : '❌ Not configured'}</div>
        <div>Cooldown: {status?.cooldownMinutes || 0} minutes</div>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={sendTest}
          className="text-xs px-3 py-1.5 rounded-md bg-[#4f46e5] text-white hover:bg-[#4338ca]"
        >
          Send Test Alert
        </button>
        {message && (
          <span className={`ml-3 text-sm ${message.kind === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>
      <div className="mt-4 text-xs text-[#7a808a]">
        Configure via .env — ALERT_EMAIL_HOST, ALERT_EMAIL_PORT, ALERT_EMAIL_USER, ALERT_EMAIL_PASS, ALERT_EMAIL_FROM, ALERT_EMAIL_TO
      </div>
    </div>
  );
};

export default AlertConfigPanel;
