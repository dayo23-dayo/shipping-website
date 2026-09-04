const crypto = require('node:crypto');
const supabase = require('./supabase');
const HttpError = require('./http-error');

function generateTrackingNumber() {
  const year = new Date().getUTCFullYear();
  return `GSL-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function mapEvent(row) {
  return {
    status: row.status,
    location: row.location,
    description: row.description,
    occurredAt: row.occurred_at,
  };
}

function mapAdminShipment(row) {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    senderName: row.sender_name,
    senderAddress: row.sender_address,
    senderPhone: row.sender_phone,
    senderEmail: row.sender_email,
    origin: row.origin,
    customerName: row.recipient_name,
    customerEmail: row.recipient_email,
    address: row.recipient_address,
    customerPhone: row.recipient_phone,
    destination: row.destination,
    country: row.destination_country,
    status: row.status,
    currentLocation: row.current_location,
    estimatedDelivery: row.estimated_delivery,
    amount: Number(row.declared_value),
    shippingFee: Number(row.shipping_fee),
    currency: row.currency,
    packageDesc: row.package_description,
    deliveryTime: row.delivery_time,
    timeFrame: row.service_level,
    createdAt: row.created_at,
    lastUpdate: row.updated_at,
    events: (row.tracking_events || []).map(mapEvent),
  };
}

function maskName(name) {
  return name
    .split(/\s+/)
    .map((part) => `${part.charAt(0)}${'*'.repeat(Math.max(1, Math.min(part.length - 1, 4)))}`)
    .join(' ');
}

function mapPublicShipment(row) {
  return {
    trackingNumber: row.tracking_number,
    origin: row.origin,
    destination: row.destination,
    country: row.destination_country,
    status: row.status,
    currentLocation: row.current_location,
    estimatedDelivery: row.estimated_delivery,
    packageDesc: row.package_description,
    serviceLevel: row.service_level,
    recipientName: maskName(row.recipient_name),
    createdAt: row.created_at,
    lastUpdate: row.updated_at,
    events: (row.tracking_events || []).map(mapEvent),
  };
}

function databaseError(error) {
  if (error?.code === '23505') return new HttpError(409, 'Tracking number already exists', 'DUPLICATE_TRACKING_NUMBER');
  console.error('Supabase error:', error?.code, error?.message);
  return new HttpError(502, 'Database operation failed', 'DATABASE_ERROR');
}

async function listShipments() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*, tracking_events(*)')
    .order('created_at', { ascending: false })
    .order('occurred_at', { referencedTable: 'tracking_events', ascending: true });
  if (error) throw databaseError(error);
  return data.map(mapAdminShipment);
}

async function getPublicShipment(trackingNumber) {
  const { data, error } = await supabase
    .from('shipments')
    .select('tracking_number, origin, destination, destination_country, status, current_location, estimated_delivery, package_description, service_level, recipient_name, created_at, updated_at, tracking_events(status, location, description, occurred_at)')
    .eq('tracking_number', trackingNumber)
    .order('occurred_at', { referencedTable: 'tracking_events', ascending: true })
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new HttpError(404, 'Shipment not found', 'SHIPMENT_NOT_FOUND');
  return mapPublicShipment(data);
}

async function createShipment(input) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = { ...input, tracking_number: input.tracking_number || generateTrackingNumber() };
    const { data, error } = await supabase.from('shipments').insert(row).select().single();
    if (!error) return mapAdminShipment(data);
    if (error.code !== '23505' || input.tracking_number || attempt === 4) throw databaseError(error);
  }
  throw new HttpError(503, 'Could not allocate tracking number', 'TRACKING_NUMBER_UNAVAILABLE');
}

async function updateShipmentStatus(trackingNumber, input) {
  const { data, error } = await supabase
    .from('shipments')
    .update({ status: input.status, current_location: input.current_location })
    .eq('tracking_number', trackingNumber)
    .select()
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new HttpError(404, 'Shipment not found', 'SHIPMENT_NOT_FOUND');
  return mapAdminShipment(data);
}

async function deleteShipment(trackingNumber) {
  const { data, error } = await supabase
    .from('shipments')
    .delete()
    .eq('tracking_number', trackingNumber)
    .select('id')
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new HttpError(404, 'Shipment not found', 'SHIPMENT_NOT_FOUND');
}

module.exports = {
  createShipment,
  deleteShipment,
  generateTrackingNumber,
  getPublicShipment,
  listShipments,
  updateShipmentStatus,
};
