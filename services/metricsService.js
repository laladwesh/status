const os = require('os');

const MAX_POINTS = 60;
const cpuHistory = [];
const memHistory = [];

const sample = () => {
  const cpuCount = os.cpus().length || 1;
  const cpuPct = Math.min(100, Number(((os.loadavg()[0] / cpuCount) * 100).toFixed(2)));
  const totalMem = os.totalmem();
  const memPct = Number((((totalMem - os.freemem()) / totalMem) * 100).toFixed(2));
  cpuHistory.push(cpuPct);
  memHistory.push(memPct);
  if (cpuHistory.length > MAX_POINTS) cpuHistory.shift();
  if (memHistory.length > MAX_POINTS) memHistory.shift();
};

let started = false;
const startMetricsSampler = () => {
  if (started) return;
  started = true;
  sample();
  setInterval(sample, 2000).unref();
};

const getMetricsSnapshot = () => ({
  cpu: [...cpuHistory],
  memory: [...memHistory],
  timestamp: new Date().toISOString(),
});

module.exports = { startMetricsSampler, getMetricsSnapshot };
