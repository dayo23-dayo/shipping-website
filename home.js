const menuButton = document.querySelector('.menu-toggle');
const navigation = document.getElementById('primary-nav');
const chatModal = document.getElementById('chatModal');

menuButton?.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    navigation?.classList.toggle('open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
});

navigation?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
        menuButton?.setAttribute('aria-expanded', 'false');
        navigation.classList.remove('open');
        document.body.classList.remove('menu-open');
    });
});

const setChatVisibility = (isVisible) => {
    if (!chatModal) return;
    chatModal.setAttribute('aria-hidden', String(!isVisible));
    if (isVisible) document.getElementById('chatInput')?.focus();
};

document.getElementById('chatBtn')?.addEventListener('click', () => setChatVisibility(true));
document.querySelector('.close-chat')?.addEventListener('click', () => setChatVisibility(false));
chatModal?.addEventListener('click', (event) => {
    if (event.target === chatModal) setChatVisibility(false);
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setChatVisibility(false);
});
