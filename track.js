const trackingForm = document.getElementById('trackingForm');
const trackingInput = document.getElementById('trackingNumber');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const trackingResult = document.getElementById('trackingResult');

function setText(id, value, fallback = '—') {
    document.getElementById(id).textContent = value || fallback;
}

function formatDate(value, includeTime = false) {
    if (!value) return 'Not available';
    const date = new Date(includeTime ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, includeTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' }).format(date);
}

function renderTimeline(events = []) {
    const timeline = document.getElementById('timeline');
    timeline.replaceChildren(...[...events].reverse().map((event) => {
        const item = document.createElement('li');
        const marker = document.createElement('span');
        marker.className = 'timeline-marker';
        const time = document.createElement('time');
        time.dateTime = event.occurredAt;
        time.textContent = formatDate(event.occurredAt, true);
        const status = document.createElement('strong');
        status.textContent = event.status;
        const location = document.createElement('p');
        location.textContent = event.location;
        item.append(marker, time, status, location);
        return item;
    }));
}

function renderShipment(shipment) {
    emptyState.hidden = true;
    errorState.hidden = true;
    trackingResult.hidden = false;
    setText('resultTrackingNumber', shipment.trackingNumber);
    setText('shipmentStatus', shipment.status);
    setText('origin', shipment.origin);
    setText('destination', shipment.destination);
    setText('currentLocation', shipment.currentLocation);
    setText('estimatedDelivery', formatDate(shipment.estimatedDelivery));
    setText('serviceLevel', shipment.serviceLevel);
    setText('lastUpdate', formatDate(shipment.lastUpdate, true));
    setText('recipientName', shipment.recipientName);
    setText('packageDescription', shipment.packageDesc);
    setText('destinationCountry', shipment.country);
    renderTimeline(shipment.events);
}

async function trackShipment(trackingNumber) {
    const normalized = trackingNumber.trim().toUpperCase();
    if (!normalized) return;
    const button = trackingForm.querySelector('button');
    button.disabled = true;
    button.textContent = 'Checking…';

    try {
        const response = await fetch(`/api/track/${encodeURIComponent(normalized)}`);
        if (!response.ok) throw new Error('Shipment not found');
        renderShipment(await response.json());
        const url = new URL(window.location.href);
        url.searchParams.set('tracking', normalized);
        window.history.replaceState({}, '', url);
    } catch {
        emptyState.hidden = true;
        trackingResult.hidden = true;
        errorState.hidden = false;
    } finally {
        button.disabled = false;
        button.textContent = 'Track shipment';
    }
}

trackingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    trackShipment(trackingInput.value);
});

const requestedTrackingNumber = new URLSearchParams(window.location.search).get('tracking');
if (requestedTrackingNumber) {
    trackingInput.value = requestedTrackingNumber;
    trackShipment(requestedTrackingNumber);
}
