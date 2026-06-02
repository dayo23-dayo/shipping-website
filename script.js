// ========== LIVE CHAT ==========
let currentCustomerEmail = null;

document.addEventListener('DOMContentLoaded', function() {
    const chatBtn = document.getElementById('chatBtn');
    const chatModal = document.getElementById('chatModal');
    const closeChat = document.querySelector('.close-chat');
    const sendChatBtn = document.getElementById('sendChat');
    
    if (chatBtn && chatModal) {
        chatBtn.onclick = function() {
            chatModal.style.display = 'block';
            if (currentCustomerEmail) loadChatHistory();
        };
    }
    if (closeChat && chatModal) {
        closeChat.onclick = function() { chatModal.style.display = 'none'; };
    }
    window.onclick = function(event) {
        if (event.target === chatModal) chatModal.style.display = 'none';
    };
    
    if (sendChatBtn) {
        sendChatBtn.onclick = async function() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (!message) return;
            
            if (!currentCustomerEmail) {
                let email = prompt('Please enter your email address:', '');
                if (!email) { alert('Email is required.'); return; }
                currentCustomerEmail = email;
            }
            let name = prompt('Your name:', 'Customer') || 'Customer';
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerEmail: currentCustomerEmail, customerName: name, message: message })
                });
                if (response.ok) {
                    input.value = '';
                    alert('Message sent!');
                    if (chatModal.style.display === 'block') loadChatHistory();
                }
            } catch (error) { alert('Error sending message.'); }
        };
    }
});

async function loadChatHistory() {
    if (!currentCustomerEmail) return;
    try {
        const response = await fetch(`/api/chat/${encodeURIComponent(currentCustomerEmail)}`);
        const messages = await response.json();
        const chatBody = document.querySelector('.chat-body');
        if (chatBody) {
            chatBody.innerHTML = messages.map(msg => `
                <div style="margin-bottom:12px; text-align:${msg.from === 'admin' ? 'left' : 'right'}">
                    <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:12px; background:${msg.from === 'admin' ? '#e3f2fd' : '#007bff'}; color:${msg.from === 'admin' ? '#000' : '#fff'}">
                        <strong>${msg.from === 'admin' ? 'Support' : 'You'}</strong><br>${msg.message}<br>
                        <small style="font-size:10px">${msg.timestamp}</small>
                    </div>
                </div>
            `).join('');
            chatBody.scrollTop = chatBody.scrollHeight;
        }
        await fetch('/api/chat/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: currentCustomerEmail }) });
    } catch (error) { console.error(error); }
}

// ========== TRACKING NUMBER GENERATOR ==========
// This generates sequential tracking numbers like GSL-2026-000001
let lastTrackingNumber = null;

async function getNextTrackingNumber() {
    try {
        // Fetch existing shipments to find the last tracking number
        const response = await fetch('/api/shipments');
        const shipments = await response.json();
        
        let maxNum = 0;
        for (const shipment of shipments) {
            if (shipment.trackingNumber) {
                // Extract the numeric part from tracking numbers like GSL-2026-000019
                const match = shipment.trackingNumber.match(/GSL-\d{4}-(\d+)/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
        }
        
        const nextNum = maxNum + 1;
        const year = new Date().getFullYear();
        const paddedNum = nextNum.toString().padStart(6, '0');
        return `GSL-${year}-${paddedNum}`;
        
    } catch (error) {
        console.error('Error generating tracking number:', error);
        // Fallback: use timestamp
        const year = new Date().getFullYear();
        const timestamp = Date.now().toString().slice(-6);
        return `GSL-${year}-${timestamp}`;
    }
}

function generateTrackingNumber() {
    getNextTrackingNumber().then(trackingNum => {
        document.getElementById('regTrackingNumber').value = trackingNum;
    });
}

// ========== ADMIN REGISTRATION ==========
async function registerPackage() {
    const trackingNumber = document.getElementById('regTrackingNumber').value;
    const senderName = document.getElementById('regSenderName').value;
    const senderAddress = document.getElementById('regSenderAddress').value;
    const senderPhone = document.getElementById('regSenderPhone').value;
    const senderEmail = document.getElementById('regSenderEmail').value;
    const origin = document.getElementById('regOrigin').value;
    const customerName = document.getElementById('regCustomerName').value;
    const customerEmail = document.getElementById('regCustomerEmail').value;
    const customerAddress = document.getElementById('regAddress').value;
    const customerPhone = document.getElementById('regCustomerPhone').value;
    const destination = document.getElementById('regDestination').value;
    const status = document.getElementById('regStatus').value;
    const currentLocation = document.getElementById('regCurrentLocation').value;
    const country = document.getElementById('regCountry').value;
    const estimatedDelivery = document.getElementById('regEstimatedDelivery').value;
    const shippingFee = document.getElementById('regShippingFee').value;
    const amount = document.getElementById('regAmount').value;
    const packageDesc = document.getElementById('regPackageDesc').value || 'Standard Package';
    const deliveryTime = document.getElementById('regDeliveryTime').value || '24/48HRS';
    const timeFrame = document.getElementById('regTimeFrame').value || 'Express';
    
    if (!trackingNumber || !senderName || !senderAddress || !senderPhone || !customerName || !customerEmail || !customerAddress || !amount || !shippingFee) {
        alert('Please fill all required fields');
        return;
    }
    
    const shipment = { trackingNumber, senderName, senderAddress, senderPhone, senderEmail, origin, customerName, customerEmail, address: customerAddress, customerPhone, destination, status, currentLocation, country, estimatedDelivery, shippingFee, amount, packageDesc, deliveryTime, timeFrame, lastUpdate: new Date().toLocaleString() };
    
    try {
        const response = await fetch('/api/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shipment) });
        if (response.ok) {
            alert('Package registered successfully!');
            const receiptUrl = `receipt.html?tracking=${encodeURIComponent(trackingNumber)}&senderName=${encodeURIComponent(senderName)}&senderAddress=${encodeURIComponent(senderAddress)}&senderPhone=${encodeURIComponent(senderPhone)}&customerName=${encodeURIComponent(customerName)}&customerAddress=${encodeURIComponent(customerAddress)}&customerPhone=${encodeURIComponent(customerPhone)}&amount=${encodeURIComponent(amount)}&shippingFee=${encodeURIComponent(shippingFee)}&packageDesc=${encodeURIComponent(packageDesc)}&deliveryTime=${encodeURIComponent(deliveryTime)}&timeFrame=${encodeURIComponent(timeFrame)}`;
            window.open(receiptUrl, '_blank');
            clearRegisterForm();
            loadShipments();
        } else { alert('Error: Tracking number may exist.'); }
    } catch (error) { alert('Error: ' + error); }
}

function clearRegisterForm() {
    const fields = ['regTrackingNumber', 'regSenderName', 'regSenderAddress', 'regSenderPhone', 'regSenderEmail', 'regOrigin', 'regCustomerName', 'regCustomerEmail', 'regAddress', 'regCustomerPhone', 'regDestination', 'regCurrentLocation', 'regCountry', 'regEstimatedDelivery', 'regAmount', 'regPackageDesc', 'regDeliveryTime', 'regTimeFrame'];
    fields.forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; });
    if (document.getElementById('regShippingFee')) document.getElementById('regShippingFee').value = '5000';
    if (document.getElementById('regStatus')) document.getElementById('regStatus').value = 'Processing';
}

async function updateStatus() {
    const trackingNumber = document.getElementById('updateTrackingNumber').value;
    const newStatus = document.getElementById('updateStatus').value;
    const newLocation = document.getElementById('updateLocation').value;
    if (!trackingNumber) { alert('Enter tracking number'); return; }
    try {
        const response = await fetch(`/api/shipments/${trackingNumber}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, currentLocation: newLocation }) });
        if (response.ok) { alert('Status updated!'); document.getElementById('updateTrackingNumber').value = ''; document.getElementById('updateLocation').value = ''; loadShipments(); } 
        else { alert('Not found'); }
    } catch (error) { alert('Error'); }
}

async function loadShipments() {
    try {
        const response = await fetch('/api/shipments');
        const shipments = await response.json();
        const tbody = document.getElementById('shipmentsTableBody');
        if (tbody) {
            if (shipments.length === 0) { tbody.innerHTML = '<tr><td colspan="11">No shipments.</td></tr>'; return; }
            tbody.innerHTML = shipments.map(s => {
                const total = (parseFloat(s.amount) || 0) + (parseFloat(s.shippingFee) || 0);
                return `<tr><td>${s.trackingNumber}</td><td>${s.customerName}</td><td>${s.customerEmail || '-'}</td><td>${s.status}</td><td>${s.currentLocation || '-'}</td><td>${s.country || '-'}</td><td>$${s.amount || '0'}</td><td>$${s.shippingFee || '0'}</td><td>$${total.toFixed(2)}</td><td>${s.estimatedDelivery || '-'}</td><td><button class="delete-btn" onclick="deleteShipment('${s.trackingNumber}')">Delete</button></td></tr>`;
            }).join('');
        }
    } catch (error) { console.error(error); }
}

async function deleteShipment(trackingNumber) {
    if (confirm('Delete?')) { await fetch(`/api/shipments/${trackingNumber}`, { method: 'DELETE' }); loadShipments(); }
}

// ========== ADMIN CHAT ==========
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        const conversations = await response.json();
        const container = document.getElementById('conversationsList');
        if (!container) return;
        if (conversations.length === 0) { container.innerHTML = '<p>No conversations.</p>'; return; }
        container.innerHTML = conversations.map(conv => `<div class="conversation-item" onclick="selectConversation('${conv.customerEmail}', '${conv.customerName.replace(/'/g, "\\'")}')"><strong>${conv.customerName}</strong><br><small>${conv.customerEmail}</small></div>`).join('');
    } catch (error) { console.error(error); }
}

let currentReplyEmail = '';
async function selectConversation(email, name) {
    currentReplyEmail = email;
    document.getElementById('replyCustomerName').value = name;
    document.getElementById('replyCustomerEmail').value = email;
    const threadDiv = document.getElementById('conversationThread');
    try {
        const response = await fetch(`/api/chat/${encodeURIComponent(email)}`);
        const messages = await response.json();
        threadDiv.innerHTML = messages.map(msg => `<div style="border-bottom:1px solid #eee; padding:8px;"><strong>${msg.from === 'admin' ? 'Admin' : msg.customerName}:</strong><br>${msg.message}<br><small>${msg.timestamp}</small></div>`).join('');
    } catch (error) { threadDiv.innerHTML = 'Error loading thread'; }
}

async function sendAdminReply() {
    const reply = document.getElementById('adminReplyText').value.trim();
    if (!reply) { alert('Type a reply'); return; }
    if (!currentReplyEmail) { alert('Select a conversation'); return; }
    try {
        const response = await fetch('/api/chat/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: currentReplyEmail, replyMessage: reply, adminName: 'Admin' }) });
        if (response.ok) {
            alert('Reply sent!');
            document.getElementById('adminReplyText').value = '';
            selectConversation(currentReplyEmail, document.getElementById('replyCustomerName').value);
            loadConversations();
        }
    } catch (error) { alert('Error'); }
}

if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', () => { loadShipments(); loadConversations(); });
}