const express = require('express');
const cors = require('cors');
const {
  generate,
  toBase64,
  buildVCard,
  buildWifi,
  buildEmail,
  buildPhone,
} = require('./generator');

const app = express();
const PORT = process.env.PORT || 3700;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'qr-code-api', version: '1.0.0' });
});

// GET /api/v1/generate — simple QR from query params
app.get('/api/v1/generate', async (req, res) => {
  try {
    const { data, format, size, errorCorrectionLevel, darkColor, lightColor, margin } = req.query;
    if (!data) return res.status(400).json({ error: 'Query parameter "data" is required' });

    const result = await generate(data, { format, size, errorCorrectionLevel, darkColor, lightColor, margin });

    if (result.contentType === 'text/plain') {
      return res.type('text/plain').send(result.content);
    }
    res.type(result.contentType).send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/generate/base64 — return base64 data URL
app.get('/api/v1/generate/base64', async (req, res) => {
  try {
    const { data, size, errorCorrectionLevel, darkColor, lightColor, margin } = req.query;
    if (!data) return res.status(400).json({ error: 'Query parameter "data" is required' });

    const b64 = await toBase64(data, { size, errorCorrectionLevel, darkColor, lightColor, margin });
    res.json({ base64: b64 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/generate — full options via body
app.post('/api/v1/generate', async (req, res) => {
  try {
    const { data, format, size, errorCorrectionLevel, darkColor, lightColor, margin, type } = req.body;

    let qrData = data;

    // Helper types
    if (type === 'email') qrData = buildEmail(req.body);
    else if (type === 'phone') qrData = buildPhone(req.body);

    if (!qrData) return res.status(400).json({ error: '"data" field is required' });

    const result = await generate(qrData, { format, size, errorCorrectionLevel, darkColor, lightColor, margin });

    if (result.contentType === 'text/plain') {
      return res.json({ base64: result.content });
    }
    if (result.contentType === 'image/svg+xml') {
      return res.type('image/svg+xml').send(result.content);
    }
    res.type(result.contentType).send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/vcard — generate QR from vCard fields
app.post('/api/v1/vcard', async (req, res) => {
  try {
    const { format, size, errorCorrectionLevel, darkColor, lightColor, margin, ...vcardFields } = req.body;
    const vcardData = buildVCard(vcardFields);
    const result = await generate(vcardData, { format, size, errorCorrectionLevel, darkColor, lightColor, margin });

    if (result.contentType === 'text/plain') {
      return res.json({ base64: result.content });
    }
    if (result.contentType === 'image/svg+xml') {
      return res.type('image/svg+xml').send(result.content);
    }
    res.type(result.contentType).send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/wifi — generate QR from WiFi credentials
app.post('/api/v1/wifi', async (req, res) => {
  try {
    const { ssid, password, encryption, format, size, errorCorrectionLevel, darkColor, lightColor, margin } = req.body;
    const wifiData = buildWifi({ ssid, password, encryption });
    const result = await generate(wifiData, { format, size, errorCorrectionLevel, darkColor, lightColor, margin });

    if (result.contentType === 'text/plain') {
      return res.json({ base64: result.content });
    }
    if (result.contentType === 'image/svg+xml') {
      return res.type('image/svg+xml').send(result.content);
    }
    res.type(result.contentType).send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`QR Code API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/v1/generate?data=...&format=png&size=300`);
  console.log(`  GET  /api/v1/generate/base64?data=...`);
  console.log(`  POST /api/v1/generate`);
  console.log(`  POST /api/v1/vcard`);
  console.log(`  POST /api/v1/wifi`);
  console.log(`  GET  /api/v1/health`);
});

module.exports = app;
