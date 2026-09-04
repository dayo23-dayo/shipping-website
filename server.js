const express = require('express');
const path = require('node:path');
const config = require('./src/config');
const HttpError = require('./src/http-error');
const shipmentService = require('./src/shipment-service');
const messageService = require('./src/message-service');
const validation = require('./src/validation');
const {
  createSession,
  requireAdmin,
  requireAdminPage,
  requireAdminOrBot,
  sessionCookie,
  verifyPassword,
} = require('./src/auth');

// ==========================================
// EXPRESS APP
// ==========================================
const app = express();
const loginAttempts = new Map();
const publicRequests = new Map();
const publicFiles = new Set([
  '/',
  '/track',
  '/login',
  '/admin',
  '/receipt',
  '/style.css',
  '/script.js',
  '/home.css',
  '/home.js',
  '/admin.css',
  '/admin.js',
  '/track.css',
  '/track.js',
  '/logo.png',
  '/pexels-yankrukov-6818154.jpg',
]);

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function rateLimit({ limit, windowMs }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    const bucket = publicRequests.get(key) || { count: 0, resetAt: Date.now() + windowMs };
    if (bucket.resetAt <= Date.now()) {
      bucket.count = 0;
      bucket.resetAt = Date.now() + windowMs;
    }
    bucket.count += 1;
    publicRequests.set(key, bucket);
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    next();
  };
}

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});
const cleanPages = new Map([
  ['/track', 'track.html'],
  ['/login', 'login.html'],
  ['/receipt', 'receipt.html'],
]);

for (const [route, file] of cleanPages) {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, file)));
}

app.get('/admin', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get(['/index.html', '/track.html', '/login.html', '/admin.html', '/receipt.html'], (req, res) => {
  const cleanPath = req.path === '/index.html' ? '/' : req.path.slice(0, -5);
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex);
  res.redirect(308, `${cleanPath}${query}`);
});
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/') && req.path !== '/health' && !publicFiles.has(req.path)) {
    return res.status(404).send('Not found');
  }
  next();
});
app.use(express.static('.', { dotfiles: 'deny', index: 'index.html' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
app.post('/api/auth/login', async (req, res, next) => {
  const clientId = req.ip;
  const attempt = loginAttempts.get(clientId) || { count: 0, resetAt: 0 };
  if (attempt.resetAt <= Date.now()) {
    attempt.count = 0;
    attempt.resetAt = Date.now() + 15 * 60 * 1000;
  }
  if (attempt.count >= 5) return res.status(429).json({ error: 'Try again later' });

  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!(await verifyPassword(password))) {
      attempt.count += 1;
      loginAttempts.set(clientId, attempt);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    loginAttempts.delete(clientId);
    res.setHeader('Set-Cookie', sessionCookie(createSession()));
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(204).end();
});

app.get('/api/auth/session', requireAdmin, (req, res) => res.json({ authenticated: true }));

// ==========================================
// SHIPMENT APIs
// ==========================================

// Get all shipments
app.get('/api/shipments', requireAdmin, asyncRoute(async (req, res) => {
  res.json(await shipmentService.listShipments());
}));

app.get('/api/shipments/tracking-number', requireAdmin, (req, res) => {
  res.json({ trackingNumber: shipmentService.generateTrackingNumber() });
});

// Track a single shipment
app.get('/api/track/:trackingNumber', rateLimit({ limit: 30, windowMs: 60_000 }), asyncRoute(async (req, res) => {
  const trackingNumber = validation.trackingNumber(req.params.trackingNumber, true);
  res.json(await shipmentService.getPublicShipment(trackingNumber));
}));

// Register a new shipment
app.post('/api/shipments', requireAdmin, asyncRoute(async (req, res) => {
  const shipment = await shipmentService.createShipment(validation.shipmentInput(req.body));
  res.status(201).json({ success: true, shipment });
}));

// Update shipment status
app.put('/api/shipments/:trackingNumber', requireAdmin, asyncRoute(async (req, res) => {
  const trackingNumber = validation.trackingNumber(req.params.trackingNumber, true);
  const shipment = await shipmentService.updateShipmentStatus(trackingNumber, validation.statusInput(req.body));
  res.json({ success: true, shipment });
}));

// Delete a shipment
app.delete('/api/shipments/:trackingNumber', requireAdmin, asyncRoute(async (req, res) => {
  const trackingNumber = validation.trackingNumber(req.params.trackingNumber, true);
  await shipmentService.deleteShipment(trackingNumber);
  res.status(204).end();
}));

// ==========================================
// CHAT APIs
// ==========================================

// Get all conversations
app.get('/api/conversations', requireAdmin, asyncRoute(async (req, res) => {
  res.json(await messageService.listConversations());
}));

// Get messages for a specific customer
app.get('/api/chat/:customerEmail', requireAdmin, asyncRoute(async (req, res) => {
  const customerEmail = validation.email(req.params.customerEmail, 'customerEmail', true);
  res.json(await messageService.getMessages(customerEmail));
}));

// Customer sends a message
app.post('/api/chat', rateLimit({ limit: 10, windowMs: 60_000 }), asyncRoute(async (req, res) => {
  await messageService.createCustomerMessage({
    customerEmail: validation.email(req.body?.customerEmail, 'customerEmail', true),
    customerName: validation.text(req.body?.customerName || 'Customer', 'customerName'),
    message: validation.text(req.body?.message, 'message', { max: 2000 }),
  });
  res.status(201).json({ success: true });
}));

// Admin replies to a customer
app.post('/api/chat/reply', requireAdminOrBot, asyncRoute(async (req, res) => {
  await messageService.createAdminReply({
    customerEmail: validation.email(req.body?.customerEmail, 'customerEmail', true),
    adminName: validation.text(req.body?.adminName || 'Support Team', 'adminName'),
    message: validation.text(req.body?.replyMessage, 'replyMessage', { max: 2000 }),
  });
  res.status(201).json({ success: true });
}));

// Mark messages as read
// ==========================================
// START SERVER
// ==========================================
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${config.port}`);
  });
}

module.exports = app;
