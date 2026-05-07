const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

require("dotenv").config();

const statusRoutes = require("./routes/statusRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { startMonitoring, runStatusCheck } = require("./services/monitorService");
const { ensureAdminUser } = require("./services/userService");
const { createRequestMetricsMiddleware } = require("./services/analyticsService");
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { startMetricsSampler, getMetricsSnapshot } = require('./services/metricsService');
const { checkAndAlert } = require('./services/alertService');
const { getMetricsOutput, updateGauges } = require('./services/prometheusService');
const { getServerHealth } = require('./services/healthService');
const { getLatestStatuses } = require('./services/monitorService');
const MetricSnapshot = require('./models/MetricSnapshot');
const incidentRoutes = require('./routes/incidentRoutes');
const sslRoutes = require('./routes/sslRoutes');
const serviceManagerRoutes = require('./routes/serviceManagerRoutes');
const alertRoutes = require('./routes/alertRoutes');
const metricsHistoryRoutes = require('./routes/metricsHistoryRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: false,
    })
  );
}

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' }
}));
app.use(createRequestMetricsMiddleware());
//endpoints
app.use("/api", statusRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api', incidentRoutes);
app.use('/api/admin/ssl', sslRoutes);
app.use('/api/admin', serviceManagerRoutes);
app.use('/api/admin/alerts', alertRoutes);
app.use('/api/admin', metricsHistoryRoutes);
app.use('/api/admin/audit', auditRoutes);

app.get('/metrics', async (req, res) => {
  const token = process.env.PROMETHEUS_TOKEN;
  if (token && req.headers['authorization'] !== `Bearer ${token}`) return res.status(401).end();
  try {
    const { output, contentType } = await getMetricsOutput();
    res.set('Content-Type', contentType);
    return res.end(output);
  } catch { return res.status(500).end(); }
});

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client/build");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).end();
    }
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

app.use("/api", (req, res) => {
  return res.status(404).json({ message: "API route not found." });
});

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is required in environment variables.");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in environment variables.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected.");

    await ensureAdminUser();
    await runStatusCheck();
    startMonitoring();

    const httpServer = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    startMetricsSampler();

    const wss = new WebSocketServer({ server: httpServer });
    wss.on('connection', (socket, req) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        socket.close(4401, 'Unauthorized');
        return;
      }
      socket.send(JSON.stringify({ type: 'metrics', data: getMetricsSnapshot() }));
    });

    setInterval(() => {
      if (wss.clients.size === 0) return;
      const payload = JSON.stringify({ type: 'metrics', data: getMetricsSnapshot() });
      wss.clients.forEach(client => { if (client.readyState === 1) client.send(payload); });
    }, 2000).unref();

    setInterval(async () => {
      try {
        const [health, statuses] = await Promise.all([getServerHealth(), getLatestStatuses()]);
        await checkAndAlert(health);
        updateGauges(health, statuses);
        MetricSnapshot.create({
          timestamp: new Date(),
          cpu: health.cpu?.loadPercentage1m,
          memory: health.memory?.usagePercentage,
          disk: health.disk?.usagePercentage,
          dbPingMs: health.database?.pingMs,
          upCount: statuses.filter(s => s.status === 'UP').length,
          totalCount: statuses.length
        }).catch(() => {});
      } catch {}
    }, 60000).unref();

    mongoose.connection.collection('statuses').createIndex(
      { timestamp: 1 }, { expireAfterSeconds: 7776000, background: true }
    ).catch(() => {});
  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
