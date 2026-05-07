import { useEffect, useState } from 'react';
import apiClient from '../api/client';

const colorClasses = (days) => {
  if (days == null) return { text: 'text-gray-400 bg-gray-50', border: 'border-gray-200' };
  if (days > 60) return { text: 'text-green-600 bg-green-50', border: 'border-green-200' };
  if (days >= 14) return { text: 'text-amber-600 bg-amber-50', border: 'border-amber-200' };
  return { text: 'text-red-600 bg-red-50', border: 'border-red-200' };
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

const SslCertPanel = () => {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/ssl');
      setCerts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#2c3138]">SSL Certificates</h3>
        <button
          type="button"
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-md border border-[#d9dde2] hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="h-32 bg-gray-50 rounded animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {certs.map((c) => {
            const cls = colorClasses(c.daysRemaining);
            return (
              <div key={c.host} className={`rounded-md p-3 border ${cls.border} ${cls.text}`}>
                <div className="font-semibold text-[#2c3138] text-sm break-all">{c.host}</div>
                <div className="mt-2">
                  <div className="text-3xl font-bold">
                    {c.daysRemaining != null ? c.daysRemaining : '—'}
                  </div>
                  <div className="text-xs uppercase tracking-wide opacity-80">days remaining</div>
                </div>
                <div className="mt-2 text-xs text-[#7a808a]">
                  {c.error ? <span className="text-red-600">{c.error}</span> : `Expires ${fmtDate(c.expiresAt)}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SslCertPanel;
