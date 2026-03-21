const QRCode = require('qrcode');

const ERROR_LEVELS = ['L', 'M', 'Q', 'H'];

const DEFAULT_OPTIONS = {
  width: 300,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
};

function buildOptions(opts = {}) {
  const size = parseInt(opts.size, 10) || DEFAULT_OPTIONS.width;
  const ecl = ERROR_LEVELS.includes(opts.errorCorrectionLevel)
    ? opts.errorCorrectionLevel
    : DEFAULT_OPTIONS.errorCorrectionLevel;

  return {
    width: Math.min(Math.max(size, 50), 2000),
    margin: opts.margin != null ? parseInt(opts.margin, 10) : DEFAULT_OPTIONS.margin,
    errorCorrectionLevel: ecl,
    color: {
      dark: opts.darkColor || opts.color?.dark || DEFAULT_OPTIONS.color.dark,
      light: opts.lightColor || opts.color?.light || DEFAULT_OPTIONS.color.light,
    },
  };
}

// --- Format builders ---

function buildVCard({ firstName, lastName, phone, email, org, title, url, address }) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];
  if (firstName || lastName) lines.push(`N:${lastName || ''};${firstName || ''}`);
  if (firstName || lastName) lines.push(`FN:${[firstName, lastName].filter(Boolean).join(' ')}`);
  if (org) lines.push(`ORG:${org}`);
  if (title) lines.push(`TITLE:${title}`);
  if (phone) lines.push(`TEL:${phone}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (url) lines.push(`URL:${url}`);
  if (address) lines.push(`ADR:;;${address}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

function buildWifi({ ssid, password, encryption }) {
  if (!ssid) throw new Error('SSID is required for WiFi QR code');
  const enc = (encryption || 'WPA').toUpperCase();
  const pass = password || '';
  return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
}

function buildEmail({ to, subject, body }) {
  if (!to) throw new Error('Email address (to) is required');
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
}

function buildPhone({ number }) {
  if (!number) throw new Error('Phone number is required');
  return `tel:${number}`;
}

// --- Generation functions ---

async function toBuffer(data, opts = {}) {
  const options = buildOptions(opts);
  return QRCode.toBuffer(data, { ...options, type: 'png' });
}

async function toSVG(data, opts = {}) {
  const options = buildOptions(opts);
  return QRCode.toString(data, { ...options, type: 'svg' });
}

async function toBase64(data, opts = {}) {
  const options = buildOptions(opts);
  const dataUrl = await QRCode.toDataURL(data, options);
  return dataUrl;
}

async function generate(data, opts = {}) {
  if (!data) throw new Error('Data is required to generate a QR code');

  const format = (opts.format || 'png').toLowerCase();

  switch (format) {
    case 'svg':
      return { content: await toSVG(data, opts), contentType: 'image/svg+xml' };
    case 'base64':
      return { content: await toBase64(data, opts), contentType: 'text/plain' };
    case 'png':
    default:
      return { content: await toBuffer(data, opts), contentType: 'image/png' };
  }
}

module.exports = {
  generate,
  toBuffer,
  toSVG,
  toBase64,
  buildVCard,
  buildWifi,
  buildEmail,
  buildPhone,
  buildOptions,
};
