import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../api/client';

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
];

const formatTick = (iso) => {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
};

const MetricsHistoryChart = () => {
  const [hours, setHours] = useState(24);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/admin/metrics/history?hours=${hours}`)
      .then((res) => {
        if (cancelled) return;
        const arr = Array.isArray(res.data?.snapshots) ? res.data.snapshots : [];
        setSnapshots(arr);
      })
      .catch(() => { if (!cancelled) setSnapshots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hours]);

  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#2c3138] mr-auto">Metrics History</h3>
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setHours(r.hours)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              hours === r.hours
                ? 'bg-[#4f46e5] text-white'
                : 'border border-[#d9dde2] text-[#7a808a] hover:text-[#2c3138]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="h-[220px] bg-gray-50 rounded animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={snapshots}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="timestamp" tickFormatter={formatTick} stroke="#7a808a" fontSize={11} />
            <YAxis domain={[0, 100]} unit="%" stroke="#7a808a" fontSize={11} />
            <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
            <Legend />
            <Line type="monotone" dataKey="cpu" name="CPU" stroke="#f59e0b" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="memory" name="Memory" stroke="#3b82f6" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="disk" name="Disk" stroke="#6b7280" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default MetricsHistoryChart;
