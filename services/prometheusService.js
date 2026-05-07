const client = require('prom-client');
client.collectDefaultMetrics();

const serviceUpGauge = new client.Gauge({ name: 'status_service_up', help: 'Service UP=1 DOWN=0', labelNames: ['service_name'] });
const cpuGauge = new client.Gauge({ name: 'status_cpu_load_percent', help: 'CPU load %' });
const memGauge = new client.Gauge({ name: 'status_memory_usage_percent', help: 'Memory usage %' });
const diskGauge = new client.Gauge({ name: 'status_disk_usage_percent', help: 'Disk usage %' });
const dbPingGauge = new client.Gauge({ name: 'status_db_ping_ms', help: 'MongoDB ping ms' });

const updateGauges = (health, statuses) => {
  try {
    if (health?.cpu?.loadPercentage1m != null) cpuGauge.set(health.cpu.loadPercentage1m);
    if (health?.memory?.usagePercentage != null) memGauge.set(health.memory.usagePercentage);
    if (health?.disk?.usagePercentage != null) diskGauge.set(health.disk.usagePercentage);
    if (health?.database?.pingMs != null) dbPingGauge.set(health.database.pingMs);
    if (Array.isArray(statuses)) {
      statuses.forEach(s => serviceUpGauge.set({ service_name: s.name }, s.status === 'UP' ? 1 : 0));
    }
  } catch {}
};

const getMetricsOutput = async () => ({
  output: await client.register.metrics(),
  contentType: client.register.contentType,
});

module.exports = { updateGauges, getMetricsOutput };
