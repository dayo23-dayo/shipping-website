const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!token || !adminChatId) {
    console.error('❌ Missing Telegram environment variables');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('✅ Telegram bot started (worker mode)');

// Notify admin that bot is online
bot.sendMessage(adminChatId, '✅ Global Shipping Logistics bot is online (worker)');

// Send notification when a new chat message arrives (called by main server via HTTP)
// We'll expose an HTTP endpoint for the main server to trigger notifications
const express = require('express');
const app = express();
app.use(express.json());

app.post('/notify', async (req, res) => {
    const { customerName, customerEmail, message } = req.body;
    const text = `📬 *New Chat Message*\n\n👤 *Customer:* ${customerName}\n📧 *Email:* ${customerEmail}\n💬 *Message:* ${message}\n\nTo reply: /reply ${customerEmail} Your message here`;
    try {
        await bot.sendMessage(adminChatId, text, { parse_mode: 'Markdown' });
        console.log('📱 Notification sent');
        res.json({ ok: true });
    } catch (err) {
        console.error('Send error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Handle admin replies
bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== adminChatId) return;
    if (!msg.text || !msg.text.startsWith('/reply')) return;
    const parts = msg.text.split(' ');
    if (parts.length < 3) {
        await bot.sendMessage(adminChatId, '❌ Usage: /reply customer@email.com Your reply message');
        return;
    }
    const customerEmail = parts[1];
    const replyMessage = parts.slice(2).join(' ');
    try {
        // Call your main website's internal API (using the service name in Railway)
        const mainApiUrl = process.env.MAIN_API_URL || 'http://localhost:3000';
        const response = await axios.post(`${mainApiUrl}/api/chat/reply`, {
            customerEmail,
            replyMessage,
            adminName: 'Telegram Admin'
        });
        if (response.data.success) {
            await bot.sendMessage(adminChatId, '✅ Reply sent to customer.');
        } else {
            await bot.sendMessage(adminChatId, '❌ Customer email not found.');
        }
    } catch (err) {
        await bot.sendMessage(adminChatId, '❌ Error: ' + err.message);
    }
});

// Start the bot's internal HTTP server on a different port
const BOT_PORT = process.env.BOT_PORT || 8081;
app.listen(BOT_PORT, () => {
    console.log(`📡 Bot notification API running on port ${BOT_PORT}`);
});