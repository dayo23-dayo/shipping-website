// ========== LIVE CHAT ==========
let currentCustomerEmail = null;

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
}

async function apiRequest(url, options) {
    const response = await fetch(url, options);
    if (response.status === 401 && window.location.pathname === '/admin') {
        window.location.href = '/login';
        throw new Error('Authentication required');
    }
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || 'Request failed');
    return body;
}

document.addEventListener('DOMContentLoaded', function() {
    const chatBtn = document.getElementById('chatBtn');
    const chatModal = document.getElementById('chatModal');
    const closeChat = document.querySelector('.close-chat');
    const sendChatBtn = document.getElementById('sendChat');
    
    if (chatBtn && chatModal) {
        chatBtn.onclick = function() {
            if (chatModal.hasAttribute('aria-hidden')) chatModal.setAttribute('aria-hidden', 'false');
            else chatModal.style.display = 'block';
        };
    }
    if (closeChat && chatModal) {
        closeChat.onclick = function() {
            if (chatModal.hasAttribute('aria-hidden')) chatModal.setAttribute('aria-hidden', 'true');
            else chatModal.style.display = 'none';
        };
    }
    window.onclick = function(event) {
        if (event.target === chatModal) {
            if (chatModal.hasAttribute('aria-hidden')) chatModal.setAttribute('aria-hidden', 'true');
            else chatModal.style.display = 'none';
        }
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
                    const chatBody = document.querySelector('.chat-body');
                    if (chatBody) chatBody.innerHTML = '<p>Your message was sent. Support will contact you by email.</p>';
                }
            } catch (error) { alert('Error sending message.'); }
        };
    }
});

// ========== TRACKING NUMBER GENERATOR ==========
let lastTrackingNumber = null;

async function getNextTrackingNumber() {
    const data = await apiRequest('/api/shipments/tracking-number');
    return data.trackingNumber;
}

function generateTrackingNumber() {
    getNextTrackingNumber().then(trackingNum => {
        document.getElementById('regTrackingNumber').value = trackingNum;
    }).catch((error) => alert(error.message));
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
    
    if (!trackingNumber || !senderName || !senderAddress || !senderPhone || !origin || !customerName || !customerEmail || !customerAddress || !destination || !country || !amount || !shippingFee) {
        alert('Please fill all required fields');
        return;
    }
    
    const shipment = { trackingNumber, senderName, senderAddress, senderPhone, senderEmail, origin, customerName, customerEmail, address: customerAddress, customerPhone, destination, status, currentLocation, country, estimatedDelivery, shippingFee, amount, packageDesc, deliveryTime, timeFrame, lastUpdate: new Date().toLocaleString() };
    
    try {
        const result = await apiRequest('/api/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shipment) });
        if (result.success) {
            const createdTrackingNumber = result.shipment.trackingNumber;
            alert('Package registered successfully!');
            const receiptUrl = `/receipt?tracking=${encodeURIComponent(createdTrackingNumber)}&senderName=${encodeURIComponent(senderName)}&senderAddress=${encodeURIComponent(senderAddress)}&senderPhone=${encodeURIComponent(senderPhone)}&customerName=${encodeURIComponent(customerName)}&customerAddress=${encodeURIComponent(customerAddress)}&customerPhone=${encodeURIComponent(customerPhone)}&amount=${encodeURIComponent(amount)}&shippingFee=${encodeURIComponent(shippingFee)}&packageDesc=${encodeURIComponent(packageDesc)}&deliveryTime=${encodeURIComponent(deliveryTime)}&timeFrame=${encodeURIComponent(timeFrame)}`;
            window.open(receiptUrl, '_blank');
            clearRegisterForm();
            loadShipments();
        }
    } catch (error) { alert(`Error: ${error.message}`); }
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
        await apiRequest(`/api/shipments/${encodeURIComponent(trackingNumber)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, currentLocation: newLocation }) });
        alert('Status updated!');
        document.getElementById('updateTrackingNumber').value = '';
        document.getElementById('updateLocation').value = '';
        loadShipments();
    } catch (error) { alert(error.message); }
}

async function loadShipments() {
    try {
        const shipments = await apiRequest('/api/shipments');
        const tbody = document.getElementById('shipmentsTableBody');
        if (tbody) {
            if (shipments.length === 0) { tbody.innerHTML = '<tr><td colspan="11">No shipments.</td></tr>'; return; }
            tbody.innerHTML = shipments.map(s => {
                const total = (parseFloat(s.amount) || 0) + (parseFloat(s.shippingFee) || 0);
                return `<tr><td>${escapeHtml(s.trackingNumber)}</td><td>${escapeHtml(s.customerName)}</td><td>${escapeHtml(s.customerEmail || '-')}</td><td>${escapeHtml(s.status)}</td><td>${escapeHtml(s.currentLocation || '-')}</td><td>${escapeHtml(s.country || '-')}</td><td>$${escapeHtml(s.amount || '0')}</td><td>$${escapeHtml(s.shippingFee || '0')}</td><td>$${total.toFixed(2)}</td><td>${escapeHtml(s.estimatedDelivery || '-')}</td><td><button class="delete-btn" data-tracking-number="${escapeHtml(s.trackingNumber)}">Delete</button></td></tr>`;
            }).join('');
            tbody.querySelectorAll('.delete-btn').forEach((button) => {
                button.addEventListener('click', () => deleteShipment(button.dataset.trackingNumber));
            });
        }
    } catch (error) { console.error(error); }
}

async function deleteShipment(trackingNumber) {
    if (confirm('Delete this shipment and its tracking history?')) {
        try {
            await apiRequest(`/api/shipments/${encodeURIComponent(trackingNumber)}`, { method: 'DELETE' });
            loadShipments();
        } catch (error) { alert(error.message); }
    }
}

// ========== ADMIN CHAT ==========
async function loadConversations() {
    try {
        const conversations = await apiRequest('/api/conversations');
        const container = document.getElementById('conversationsList');
        if (!container) return;
        if (conversations.length === 0) { container.innerHTML = '<p>No conversations.</p>'; return; }
        container.innerHTML = conversations.map((conv, index) => `<button type="button" class="conversation-item" data-index="${index}"><strong>${escapeHtml(conv.customerName)}</strong><br><small>${escapeHtml(conv.customerEmail)}</small></button>`).join('');
        container.querySelectorAll('.conversation-item').forEach((button) => {
            button.addEventListener('click', () => {
                const conversation = conversations[Number(button.dataset.index)];
                selectConversation(conversation.customerEmail, conversation.customerName);
            });
        });
    } catch (error) { console.error(error); }
}

let currentReplyEmail = '';
async function selectConversation(email, name) {
    currentReplyEmail = email;
    document.getElementById('replyCustomerName').value = name;
    document.getElementById('replyCustomerEmail').value = email;
    const threadDiv = document.getElementById('conversationThread');
    try {
        const messages = await apiRequest(`/api/chat/${encodeURIComponent(email)}`);
        threadDiv.innerHTML = messages.map(msg => `<div style="border-bottom:1px solid #eee; padding:8px;"><strong>${escapeHtml(msg.from === 'admin' ? (msg.adminName || 'Admin') : (msg.customerName || 'Customer'))}:</strong><br>${escapeHtml(msg.message)}<br><small>${escapeHtml(new Date(msg.timestamp).toLocaleString())}</small></div>`).join('');
    } catch (error) { threadDiv.innerHTML = 'Error loading thread'; }
}

async function sendAdminReply() {
    const reply = document.getElementById('adminReplyText').value.trim();
    if (!reply) { alert('Type a reply'); return; }
    if (!currentReplyEmail) { alert('Select a conversation'); return; }
    try {
        await apiRequest('/api/chat/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: currentReplyEmail, replyMessage: reply, adminName: 'Admin' }) });
        alert('Reply sent!');
        document.getElementById('adminReplyText').value = '';
        selectConversation(currentReplyEmail, document.getElementById('replyCustomerName').value);
        loadConversations();
    } catch (error) { alert(error.message); }
}

if (window.location.pathname === '/admin') {
    document.addEventListener('DOMContentLoaded', () => {
        generateTrackingNumber();
        loadShipments();
        loadConversations();
    });
}
