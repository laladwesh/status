const os = require('os');
const nodemailer = require('nodemailer');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ALERT_COOLDOWN_MINUTES = parsePositiveInt(process.env.ALERT_COOLDOWN_MINUTES, 30);

const cooldownMap = new Map();

let mailTransporter = null;
const getMailTransporter = () => {
  if (mailTransporter) return mailTransporter;
  const host = process.env.ALERT_EMAIL_HOST;
  const user = process.env.ALERT_EMAIL_USER;
  const pass = process.env.ALERT_EMAIL_PASS;
  if (!host || !user || !pass) return null;
  try {
    mailTransporter = nodemailer.createTransport({
      host,
      port: parsePositiveInt(process.env.ALERT_EMAIL_PORT, 587),
      secure: false,
      auth: { user, pass },
    });
    return mailTransporter;
  } catch (err) {
    console.error('alertService: failed to init mail transporter:', err.message);
    return null;
  }
};

const isEmailConfigured = () =>
  Boolean(
    process.env.ALERT_EMAIL_HOST &&
      process.env.ALERT_EMAIL_USER &&
      process.env.ALERT_EMAIL_PASS &&
      process.env.ALERT_EMAIL_FROM &&
      process.env.ALERT_EMAIL_TO
  );

const sendEmail = async (subject, text) => {
  try {
    const transporter = getMailTransporter();
    if (!transporter) return;
    await transporter.sendMail({
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO,
      subject,
      text,
    });
  } catch (err) {
    console.error('alertService: email send failed:', err.message);
  }
};

const dispatchAlert = async (subject, body) => {
  if (!isEmailConfigured()) return;
  await sendEmail(subject, body);
};

const checkMetric = async (metricKey, value, threshold, label, unit) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return;
  if (value <= threshold) return;

  const last = cooldownMap.get(metricKey) || 0;
  const now = Date.now();
  const cooldownMs = ALERT_COOLDOWN_MINUTES * 60 * 1000;
  if (now - last < cooldownMs) return;

  cooldownMap.set(metricKey, now);

  const subject = `🚨 ${label} alert on ${os.hostname()}`;
  const body = `${label} is at ${value}${unit} (threshold ${threshold}${unit}).`;
  await dispatchAlert(subject, body);
};

const checkAndAlert = async (healthData) => {
  if (!healthData) return;
  try {
    await checkMetric(
      'cpu',
      healthData.cpu?.loadPercentage1m,
      90,
      'CPU load (1m)',
      '%'
    );
    await checkMetric(
      'memory',
      healthData.memory?.usagePercentage,
      90,
      'Memory usage',
      '%'
    );
    await checkMetric(
      'disk',
      healthData.disk?.usagePercentage,
      92,
      'Disk usage',
      '%'
    );
  } catch (err) {
    console.error('alertService: checkAndAlert failed:', err.message);
  }
};

const sendTestAlert = async () => {
  const subject = `🔔 Test alert from status-dashboard [${os.hostname()}]`;
  const body = `This is a test alert sent at ${new Date().toISOString()}.`;
  await dispatchAlert(subject, body);
};

const getAlertStatus = () => ({
  email: isEmailConfigured(),
  cooldownMinutes: ALERT_COOLDOWN_MINUTES,
});

module.exports = { checkAndAlert, sendTestAlert, getAlertStatus };
