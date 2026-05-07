import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const formatNum = (n) => (typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(1) : '--');

const stats = (arr) => {
  if (!arr || arr.length === 0) return { min: '--', avg: '--', max: '--' };
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { min: formatNum(min), avg: formatNum(avg), max: formatNum(max) };
};

const badgeFor = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'bg-gray-100 text-gray-600';
  if (value < 70) return 'bg-green-100 text-green-700';
  if (value <= 90) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const labelFor = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  if (value < 70) return 'Healthy';
  if (value <= 90) return 'Watch';
  return 'High';
};

const MetricCard = ({ label, data, color, fillOpacity }) => {
  const arr = Array.isArray(data) ? data : [];
  const current = arr.length > 0 ? arr[arr.length - 1] : null;
  const s = stats(arr);
  const chartData = arr.map((v, i) => ({ i, v }));
  return (
    <div className="bg-white border border-[#d9dde2] rounded-md p-4 flex-1 min-w-[260px]">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs text-[#7a808a] uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-semibold text-[#2c3138] mt-1">
            {current != null ? `${formatNum(current)}%` : '--'}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeFor(current)}`}>
          {labelFor(current)}
        </span>
      </div>
      <div style={{ height: 60 }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                fill={color}
                fillOpacity={fillOpacity}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full bg-gray-50 rounded animate-pulse" />
        )}
      </div>
      <div className="flex justify-between mt-3 text-xs text-[#7a808a]">
        <div><span className="font-medium text-[#2c3138]">Min</span> {s.min}{s.min !== '--' ? '%' : ''}</div>
        <div><span className="font-medium text-[#2c3138]">Avg</span> {s.avg}{s.avg !== '--' ? '%' : ''}</div>
        <div><span className="font-medium text-[#2c3138]">Max</span> {s.max}{s.max !== '--' ? '%' : ''}</div>
      </div>
    </div>
  );
};

const Skeleton = () => (
  <div className="bg-white border border-[#d9dde2] rounded-md p-4 flex-1 min-w-[260px]">
    <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-2" />
    <div className="h-8 w-20 bg-gray-100 rounded animate-pulse mb-3" />
    <div className="h-[60px] bg-gray-50 rounded animate-pulse" />
    <div className="h-3 w-full bg-gray-100 rounded animate-pulse mt-3" />
  </div>
);

const LiveMetricsCharts = ({ metrics, connected }) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#2c3138] uppercase tracking-wide">Live Metrics</h2>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className={connected ? 'text-green-700 font-medium' : 'text-gray-500'}>
            {connected ? 'LIVE' : 'POLLING'}
          </span>
        </div>
      </div>
      <div className="flex flex-row flex-wrap gap-4">
        {metrics ? (
          <>
            <MetricCard label="CPU Load %" data={metrics.cpu} color="#f59e0b" fillOpacity={0.15} />
            <MetricCard label="Memory Usage %" data={metrics.memory} color="#3b82f6" fillOpacity={0.15} />
          </>
        ) : (
          <>
            <Skeleton />
            <Skeleton />
          </>
        )}
      </div>
    </div>
  );
};

export default LiveMetricsCharts;
