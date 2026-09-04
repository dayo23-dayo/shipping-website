const test = require('node:test');
const assert = require('node:assert/strict');
const { shipmentInput, statusInput, trackingNumber } = require('../src/validation');

const validShipment = {
  senderName: 'Sender Name',
  senderAddress: '1 Origin Road',
  senderPhone: '+10000000000',
  senderEmail: 'sender@example.com',
  origin: 'Lagos, Nigeria',
  customerName: 'Recipient Name',
  customerEmail: 'recipient@example.com',
  address: '2 Destination Road',
  customerPhone: '+20000000000',
  destination: 'London',
  country: 'United Kingdom',
  status: 'Processing',
  currentLocation: 'Lagos Hub',
  estimatedDelivery: '2026-09-10',
  shippingFee: '50.25',
  amount: '500',
};

test('normalizes a valid shipment payload for the database', () => {
  const result = shipmentInput(validShipment);
  assert.equal(result.recipient_email, 'recipient@example.com');
  assert.equal(result.declared_value, 500);
  assert.equal(result.shipping_fee, 50.25);
  assert.equal(result.currency, 'USD');
});

test('rejects malformed tracking numbers', () => {
  assert.throws(() => trackingNumber('GSL-2026-000001', true), /Invalid tracking number format/);
  assert.equal(trackingNumber('gsl-2026-ab12cd34', true), 'GSL-2026-AB12CD34');
});

test('rejects unsupported statuses', () => {
  assert.throws(() => statusInput({ status: 'Lost', currentLocation: 'Hub' }), /Invalid shipment status/);
});

test('rejects negative monetary values', () => {
  assert.throws(() => shipmentInput({ ...validShipment, shippingFee: -1 }), /non-negative amount/);
});
