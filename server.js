const express = require('express');
const cors = require('cors');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Data files
const SHIPMENTS_FILE = 'shipments.json';
const CHAT_FILE = 'messages.json';

// Initialize files
if (!fs.existsSync(SHIPMENTS_FILE)) fs.writeFileSync(SHIPMENTS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2));

// Helper functions
const readShipments = () => JSON.parse(fs.readFileSync(SHIPMENTS_FILE));
const writeShipments = (data) => fs.writeFileSync(SHIPMENTS_FILE, JSON.stringify(data, null, 2));
const readMessages = () => JSON.parse(fs.readFileSync(CHAT_FILE));
const writeMessages = (data) => fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));

// ========== SHIPMENT APIs ==========
app.get('/api/shipments', (req, res) => {
    res.json(readShipments());
});

app.get('/api/track/:trackingNumber', (req, res) => {
    const shipments = readShipments();
    const shipment = shipments.find(s => s.trackingNumber === req.params.trackingNumber);
    shipment ? res.json(shipment) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/shipments', (req, res) => {
    const shipments = readShipments();
    const newShipment = req.body;
    if (shipments.find(s => s.trackingNumber === newShipment.trackingNumber)) {
        return res.status(400).json({ error: 'Tracking number exists' });
    }
    shipments.push(newShipment);
    writeShipments(shipments);
    res.json({ success: true });
});

app.put('/api/shipments/:trackingNumber', (req, res) => {
    const shipments = readShipments();
    const index = shipments.findIndex(s => s.trackingNumber === req.params.trackingNumber);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    shipments[index].status = req.body.status;
    shipments[index].lastUpdate = new Date().toLocaleString();
    if (req.body.currentLocation) shipments[index].currentLocation = req.body.currentLocation;
    writeShipments(shipments);
    res.json({ success: true });
});

app.delete('/api/shipments/:trackingNumber', (req, res) => {
    let shipments = readShipments();
    shipments = shipments.filter(s => s.trackingNumber !== req.params.trackingNumber);
    writeShipments(shipments);
    res.json({ success: true });
});

// ========== CHAT APIs ==========
app.get('/api/conversations', (req, res) => {
    const messages = readMessages();
    const conversations = {};
    messages.forEach(msg => {
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
    for (let email in conversations) {
        conversations[email].messages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    res.json(Object.values(conversations));
});

app.get('/api/chat/:customerEmail', (req, res) => {
    const messages = readMessages();
    const customerMessages = messages.filter(m => m.customerEmail === req.params.customerEmail);
    customerMessages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(customerMessages);
});

app.post('/api/chat', (req, res) => {
    const messages = readMessages();
    const { customerEmail, customerName, message } = req.body;
    if (!customerEmail || !message) {
        return res.status(400).json({ error: 'Email and message required' });
    }
    const newMsg = {
        id: Date.now(),
        from: 'customer',
        customerName: customerName || 'Anonymous',
        customerEmail: customerEmail,
        message: message,
        timestamp: new Date().toLocaleString(),
        read: false
    };
    messages.push(newMsg);
    writeMessages(messages);
    console.log(`💬 New message from ${customerEmail}: ${message}`);
    
    // Send Telegram notification if bot is active
    sendTelegramNotification(customerName, customerEmail, message);
    
    res.json({ success: true });
});

app.post('/api/chat/reply', (req, res) => {
    const messages = readMessages();
    const { customerEmail, replyMessage, adminName } = req.body;
    if (!customerEmail || !replyMessage) {
        return res.status(400).json({ error: 'Missing email or reply' });
    }
    const newReply = {
        id: Date.now(),
        from: 'admin',
        adminName: adminName || 'Support Team',
        customerEmail: customerEmail,
        message: replyMessage,
        timestamp: new Date().toLocaleString(),
        read: true
    };
    messages.push(newReply);
    writeMessages(messages);
    console.log(`✉️ Reply sent to ${customerEmail}`);
    res.json({ success: true });
});

app.post('/api/chat/mark-read', (req, res) => {
    let messages = readMessages();
    const { customerEmail } = req.body;
    messages = messages.map(msg => {
        if (msg.customerEmail === customerEmail && msg.from === 'admin') msg.read = true;
        return msg;
    });
    writeMessages(messages);
    res.json({ success: true });
});

// ========== TELEGRAM BOT ==========
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

let bot = null;
if (TELEGRAM_TOKEN && ADMIN_CHAT_ID) {
    try {
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
        console.log('✅ Telegram bot started');
        bot.sendMessage(ADMIN_CHAT_ID, '✅ Global Shipping Logistics bot is online!');
    } catch (err) {
        console.error('❌ Telegram bot error:', err.message);
    }
}

async function sendTelegramNotification(customerName, customerEmail, message) {
    if (!bot || !ADMIN_CHAT_ID) return;
    const text = `📬 *New Chat Message*\n\n👤 *Customer:* ${customerName}\n📧 *Email:* ${customerEmail}\n💬 *Message:* ${message}\n\nTo reply: /reply ${customerEmail} Your message here`;
    try {
        await bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
        console.log('📱 Telegram notification sent');
    } catch (err) {
        console.error('Telegram send error:', err.message);
    }
}

if (bot && ADMIN_CHAT_ID) {
    bot.on('message', async (msg) => {
        if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
        if (!msg.text) return;
        const replyText = msg.text;
        if (replyText.startsWith('/reply')) {
            const parts = replyText.split(' ');
            if (parts.length < 3) {
                await bot.sendMessage(ADMIN_CHAT_ID, '❌ Usage: /reply customer@email.com Your reply message');
                return;
            }
            const customerEmail = parts[1];
            const replyMessage = parts.slice(2).join(' ');
            try {
                const response = await axios.post(`http://localhost:${PORT}/api/chat/reply`, {
                    customerEmail: customerEmail,
                    replyMessage: replyMessage,
                    adminName: 'Telegram Admin'
                });
                if (response.data.success) {
                    await bot.sendMessage(ADMIN_CHAT_ID, '✅ Reply sent to customer.');
                } else {
                    await bot.sendMessage(ADMIN_CHAT_ID, '❌ Customer email not found. Use exact email from notification.');
                }
            } catch (err) {
                await bot.sendMessage(ADMIN_CHAT_ID, '❌ Error: ' + err.message);
            }
        } else {
            await bot.sendMessage(ADMIN_CHAT_ID, 'ℹ️ To reply, use: /reply customer@email.com Your message');
        }
    });
}

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📦 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`🔍 Tracking: http://localhost:${PORT}/track.html`);
    console.log(`💬 Live chat with Telegram bot active`);
});