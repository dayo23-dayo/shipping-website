const HttpError = require('./http-error');

const STATUSES = new Set(['Processing', 'In Transit', 'On Hold', 'Delivering', 'Delivered', 'Cancelled']);
const TRACKING_NUMBER_PATTERN = /^GSL-\d{4}-[A-Z0-9]{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, field, { required = true, max = 255 } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`, 'VALIDATION_ERROR');
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`, 'VALIDATION_ERROR');
  const normalized = value.trim();
  if (!normalized && required) throw new HttpError(400, `${field} is required`, 'VALIDATION_ERROR');
  if (normalized.length > max) throw new HttpError(400, `${field} is too long`, 'VALIDATION_ERROR');
  return normalized || null;
}

function email(value, field, required = false) {
  const normalized = text(value, field, { required, max: 254 });
  if (normalized && !EMAIL_PATTERN.test(normalized)) {
    throw new HttpError(400, `${field} must be a valid email`, 'VALIDATION_ERROR');
  }
  return normalized?.toLowerCase() || null;
}

function money(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) {
    throw new HttpError(400, `${field} must be a valid non-negative amount`, 'VALIDATION_ERROR');
  }
  return Math.round(number * 100) / 100;
}

function date(value, field) {
  if (!value) return null;
  const normalized = text(value, field, { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new HttpError(400, `${field} must use YYYY-MM-DD`, 'VALIDATION_ERROR');
  }
  return normalized;
}

function trackingNumber(value, required = false) {
  if (!value && !required) return null;
  const normalized = text(value, 'trackingNumber', { required, max: 21 }).toUpperCase();
  if (!TRACKING_NUMBER_PATTERN.test(normalized)) {
    throw new HttpError(400, 'Invalid tracking number format', 'VALIDATION_ERROR');
  }
  return normalized;
}

function status(value) {
  const normalized = text(value, 'status', { max: 20 });
  if (!STATUSES.has(normalized)) throw new HttpError(400, 'Invalid shipment status', 'VALIDATION_ERROR');
  return normalized;
}

function shipmentInput(body = {}) {
  return {
    tracking_number: trackingNumber(body.trackingNumber),
    sender_name: text(body.senderName, 'senderName'),
    sender_address: text(body.senderAddress, 'senderAddress', { max: 500 }),
    sender_phone: text(body.senderPhone, 'senderPhone', { max: 40 }),
    sender_email: email(body.senderEmail, 'senderEmail'),
    origin: text(body.origin, 'origin'),
    recipient_name: text(body.customerName, 'customerName'),
    recipient_email: email(body.customerEmail, 'customerEmail', true),
    recipient_address: text(body.address, 'address', { max: 500 }),
    recipient_phone: text(body.customerPhone, 'customerPhone', { required: false, max: 40 }),
    destination: text(body.destination, 'destination'),
    destination_country: text(body.country, 'country'),
    status: status(body.status || 'Processing'),
    current_location: text(body.currentLocation || body.origin, 'currentLocation'),
    estimated_delivery: date(body.estimatedDelivery, 'estimatedDelivery'),
    declared_value: money(body.amount, 'amount'),
    shipping_fee: money(body.shippingFee, 'shippingFee'),
    currency: text(body.currency || 'USD', 'currency', { max: 3 }).toUpperCase(),
    package_description: text(body.packageDesc || 'Standard Package', 'packageDesc'),
    delivery_time: text(body.deliveryTime, 'deliveryTime', { required: false }),
    service_level: text(body.timeFrame || 'Express', 'timeFrame'),
  };
}

function statusInput(body = {}) {
  return {
    status: status(body.status),
    current_location: text(body.currentLocation, 'currentLocation'),
    description: text(body.description, 'description', { required: false, max: 500 }),
  };
}

module.exports = { email, shipmentInput, statusInput, text, trackingNumber };
