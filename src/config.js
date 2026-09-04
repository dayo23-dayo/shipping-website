const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const config = {
  port: Number.parseInt(process.env.PORT || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),
  sessionSecret: required('SESSION_SECRET'),
  botInternalApiKey: process.env.BOT_INTERNAL_API_KEY?.trim() || null,
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

if (config.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters');
}

module.exports = config;
