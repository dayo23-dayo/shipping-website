const adminTabs = {
    register: document.getElementById('registerTab'),
    update: document.getElementById('updateTab'),
    chats: document.getElementById('chatsTab'),
    all: document.getElementById('allTab'),
};
const adminSidebar = document.querySelector('.admin-sidebar');
const adminMenuToggle = document.getElementById('adminMenuToggle');

adminMenuToggle?.addEventListener('click', () => {
    const isOpen = adminMenuToggle.getAttribute('aria-expanded') === 'true';
    adminMenuToggle.setAttribute('aria-expanded', String(!isOpen));
    adminMenuToggle.setAttribute('aria-label', isOpen ? 'Open admin menu' : 'Close admin menu');
    adminSidebar.classList.toggle('menu-open', !isOpen);
});

document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((item) => item.classList.toggle('active', item === button));
        Object.values(adminTabs).forEach((panel) => { panel.style.display = 'none'; });

        const selectedTab = button.dataset.tab;
        adminTabs[selectedTab].style.display = 'block';
        if (selectedTab === 'chats') loadConversations();
        if (selectedTab === 'all') loadShipments();
        adminSidebar.classList.remove('menu-open');
        adminMenuToggle?.setAttribute('aria-expanded', 'false');
    });
});

document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
        window.location.href = '/login';
    }
});
