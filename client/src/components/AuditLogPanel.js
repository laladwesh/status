import { useEffect, useState } from 'react';
import apiClient from '../api/client';

const actionBadge = (action) => {
  if (!action) return 'bg-gray-100 text-gray-600';
  if (action.startsWith('auth.')) return 'bg-gray-100 text-gray-600';
  if (action.endsWith('.create')) return 'bg-green-100 text-green-700';
  if (action.endsWith('.update')) return 'bg-amber-100 text-amber-700';
  if (action.endsWith('.delete')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
};

const fmt = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); }
  catch { return '—'; }
};

const AuditLogPanel = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiClient.get('/admin/audit');
        if (!cancelled) setLogs(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <h3 className="text-sm font-semibold text-[#2c3138] mb-3">Audit Log</h3>
      {loading ? (
        <div className="h-32 bg-gray-50 rounded animate-pulse" />
      ) : logs.length === 0 ? (
        <div className="text-sm text-[#7a808a] py-6 text-center">No audit entries.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#7a808a] uppercase border-b border-[#d9dde2]">
                <th className="py-2 px-2">Timestamp</th>
                <th className="py-2 px-2">Action</th>
                <th className="py-2 px-2">Admin User</th>
                <th className="py-2 px-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-[#f0f1f3]">
                  <td className="py-2 px-2 text-xs text-[#7a808a]">{fmt(log.timestamp)}</td>
                  <td className="py-2 px-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${actionBadge(log.action)}`}>
                      {log.action || '—'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-sm text-[#2c3138]">{log.adminUser || '—'}</td>
                  <td className="py-2 px-2 text-xs text-[#7a808a]">{log.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogPanel;
