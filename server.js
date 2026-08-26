const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// 🔑 SUPABASE CREDENTIALS
// ==========================================
const supabaseURL = 'https://redacted.invalid';
const supabase_ANON_KEY = 'REMOVED_SUPABASE_KEY=';

const supabase = createClient(supabaseURL, supabase_ANON_KEY);

// ==========================================
// EXPRESS APP
// ==========================================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/health', (req, res) => res.send('OK'));

// ==========================================
// SHIPMENT APIs
// ==========================================

// Get all shipments
app.get('/api/shipments', async (req, res) => {
  const { data, error } = await supabase.from('shipments').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Track a single shipment
app.get('/api/track/:trackingNumber', async (req, res) => {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('trackingNumber', req.params.trackingNumber)
    .single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

// Register a new shipment
app.post('/api/shipments', async (req, res) => {
  const newShipment = req.body;
  
  // Check if tracking number exists
  const { data: existing } = await supabase
    .from('shipments')
    .select('trackingNumber')
    .eq('trackingNumber', newShipment.trackingNumber)
    .single();
  
  if (existing) {
    return res.status(400).json({ error: 'Tracking number exists' });
  }
  
  const { data, error } = await supabase
    .from('shipments')
    .insert([newShipment]);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Update shipment status
app.put('/api/shipments/:trackingNumber', async (req, res) => {
  const { status, currentLocation } = req.body;
  const { data, error } = await supabase
    .from('shipments')
    .update({ 
      status, 
      currentLocation, 
      lastUpdate: new Date().toLocaleString() 
    })
    .eq('trackingNumber', req.params.trackingNumber);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Delete a shipment
app.delete('/api/shipments/:trackingNumber', async (req, res) => {
  const { error } = await supabase
    .from('shipments')
    .delete()
    .eq('trackingNumber', req.params.trackingNumber);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// CHAT APIs
// ==========================================

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: true });
  
  if (error) return res.status(500).json({ error: error.message });
  
  const conversations = {};
  data.forEach(msg => {
    const email = msg.customerEmail;
    if (!email) return;
    if (!conversations[email]) {
      conversations[email] = { 
        customerEmail: email, 
        customerName: msg.customerName, 
        messages: [] 
      };
    }
    conversations[email].messages.push(msg);
  });
  
  res.json(Object.values(conversations));
});

// Get messages for a specific customer
app.get('/api/chat/:customerEmail', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('customerEmail', req.params.customerEmail)
    .order('timestamp', { ascending: true });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Customer sends a message
app.post('/api/chat', async (req, res) => {
  const { customerEmail, customerName, message } = req.body;
  if (!customerEmail || !message) {
    return res.status(400).json({ error: 'Email and message required' });
  }
  
  const newMsg = {
    from_user: 'customer',
    customerName: customerName || 'Anonymous',
    customerEmail,
    message,
    timestamp: new Date().toLocaleString(),
    read: false,
    replied: false,
    replyDate: null,
    adminName: null,
  };
  
  const { error } = await supabase.from('messages').insert([newMsg]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Admin replies to a customer
app.post('/api/chat/reply', async (req, res) => {
  const { customerEmail, replyMessage, adminName } = req.body;
  if (!customerEmail || !replyMessage) {
    return res.status(400).json({ error: 'Missing email or reply' });
  }
  
  const newReply = {
    from_user: 'admin',
    adminName: adminName || 'Support Team',
    customerEmail,
    message: replyMessage,
    timestamp: new Date().toLocaleString(),
    read: true,
    replied: true,
    replyDate: new Date().toLocaleString(),
    customerName: null,
  };
  
  const { error } = await supabase.from('messages').insert([newReply]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Mark messages as read
app.post('/api/chat/mark-read', async (req, res) => {
  const { customerEmail } = req.body;
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('customerEmail', customerEmail)
    .eq('from_user', 'admin');
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📦 Admin Panel: http://0.0.0.0:${PORT}/admin.html`);
  console.log(`🔍 Tracking: http://0.0.0.0:${PORT}/track.html`);
});