const adminTabs = {
    register: document.getElementById('registerTab'),
    update: document.getElementById('updateTab'),
    chats: document.getElementById('chatsTab'),
    all: document.getElementById('allTab'),
};

document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((item) => item.classList.toggle('active', item === button));
        Object.values(adminTabs).forEach((panel) => { panel.style.display = 'none'; });

        const selectedTab = button.dataset.tab;
        adminTabs[selectedTab].style.display = 'block';
        if (selectedTab === 'chats') loadConversations();
        if (selectedTab === 'all') loadShipments();
    });
});

document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
        window.location.href = '/login';
    }
});
