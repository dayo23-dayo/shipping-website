const supabase = require('./supabase');
const HttpError = require('./http-error');

function mapMessage(row) {
  return {
    id: row.id,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    from: row.sender_type,
    message: row.message,
    read: row.is_read,
    adminName: row.admin_name,
    timestamp: row.created_at,
  };
}

function databaseError(error) {
  console.error('Supabase error:', error?.code, error?.message);
  return new HttpError(502, 'Database operation failed', 'DATABASE_ERROR');
}

async function listConversations() {
  const { data, error } = await supabase.from('messages').select('*').order('created_at');
  if (error) throw databaseError(error);

  const conversations = new Map();
  for (const row of data) {
    const key = row.customer_email.toLowerCase();
    if (!conversations.has(key)) {
      conversations.set(key, {
        customerEmail: row.customer_email,
        customerName: row.customer_name || 'Customer',
        messages: [],
      });
    }
    const conversation = conversations.get(key);
    if (row.customer_name) conversation.customerName = row.customer_name;
    conversation.messages.push(mapMessage(row));
  }
  return [...conversations.values()];
}

async function getMessages(customerEmail) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .ilike('customer_email', customerEmail)
    .order('created_at');
  if (error) throw databaseError(error);
  return data.map(mapMessage);
}

async function createCustomerMessage({ customerEmail, customerName, message }) {
  const { error } = await supabase.from('messages').insert({
    customer_email: customerEmail,
    customer_name: customerName,
    sender_type: 'customer',
    message,
  });
  if (error) throw databaseError(error);
}

async function createAdminReply({ customerEmail, adminName, message }) {
  const { error } = await supabase.from('messages').insert({
    customer_email: customerEmail,
    sender_type: 'admin',
    message,
    admin_name: adminName,
    is_read: false,
  });
  if (error) throw databaseError(error);
}

module.exports = { createAdminReply, createCustomerMessage, getMessages, listConversations };
