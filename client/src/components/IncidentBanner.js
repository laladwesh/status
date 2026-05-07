import { useEffect, useState } from 'react';
import apiClient from '../api/client';

const SEVERITY_STYLES = {
  critical: 'bg-red-50 border-red-200',
  major: 'bg-red-50 border-red-200',
  minor: 'bg-amber-50 border-amber-200',
  maintenance: 'bg-blue-50 border-blue-200',
};

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-blue-100 text-blue-700',
};

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

const IncidentBanner = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchIncidents = async () => {
      try {
        const res = await apiClient.get('/incidents');
        if (!cancelled) setIncidents(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setIncidents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchIncidents();
    const id = setInterval(fetchIncidents, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading || incidents.length === 0) return null;

  return (
    <div className="mb-4">
      {incidents.map((inc) => {
        const containerCls = SEVERITY_STYLES[inc.severity] || SEVERITY_STYLES.minor;
        const badgeCls = SEVERITY_BADGE[inc.severity] || SEVERITY_BADGE.minor;
        const lastUpdate = inc.updates && inc.updates.length > 0 ? inc.updates[inc.updates.length - 1] : null;
        return (
          <div key={inc._id} className={`rounded-md p-4 mb-3 border ${containerCls}`}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${badgeCls}`}>
                {inc.severity}
              </span>
              <span className="font-semibold text-[#2c3138]">{inc.title}</span>
              <span className="text-xs text-[#7a808a] capitalize">· {inc.status}</span>
              <span className="text-xs text-[#7a808a] ml-auto">{timeAgo(inc.createdAt)}</span>
            </div>
            {Array.isArray(inc.affectedServices) && inc.affectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {inc.affectedServices.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{s}</span>
                ))}
              </div>
            )}
            {lastUpdate && (
              <div className="text-sm text-[#3a3f45]">{lastUpdate.message}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default IncidentBanner;
