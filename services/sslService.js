const tls = require('tls');
const { URL } = require('url');

const HTTPS_URLS = [
  'https://prasadacademic.in',
  'https://easeexit.prasadacademic.in',
  'https://elective.prasadacademic.in',
];

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache = { data: null, expiresAt: 0 };

const checkOne = (rawUrl) => new Promise((resolve) => {
  let host;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return resolve({ host: rawUrl, daysRemaining: null, error: 'Invalid URL', status: 'unknown' });
  }

  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    try { socket && socket.end(); } catch {}
    resolve(result);
  };

  const socket = tls.connect(
    {
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: 8000,
    },
    () => {
      try {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          return finish({ host, daysRemaining: null, error: 'No certificate', status: 'unknown' });
        }
        const expiresAt = cert.valid_to;
        const daysRemaining = Math.floor((new Date(expiresAt) - Date.now()) / 86400000);
        const status =
          daysRemaining > 30 ? 'ok' :
          daysRemaining > 14 ? 'warning' :
          daysRemaining > 0 ? 'critical' : 'expired';
        finish({ host, daysRemaining, expiresAt, status });
      } catch (err) {
        finish({ host, daysRemaining: null, error: 'Could not connect', status: 'unknown' });
      }
    }
  );

  socket.on('error', () => finish({ host, daysRemaining: null, error: 'Could not connect', status: 'unknown' }));
  socket.on('timeout', () => finish({ host, daysRemaining: null, error: 'Could not connect', status: 'unknown' }));
});

const getSslCertificates = async () => {
  if (cache.data && Date.now() < cache.expiresAt) {
    return cache.data;
  }
  const data = await Promise.all(HTTPS_URLS.map(checkOne));
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
};

module.exports = { getSslCertificates };
