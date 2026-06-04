
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Simple route
app.get('/', (req, res) => {
    res.send('Hello from Global Shipping Logistics API!');
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});