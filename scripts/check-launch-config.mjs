const requiredValues = [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_SITE_URL',
  'PUBLIC_OPERATOR_NAME',
  'PUBLIC_SUPPORT_EMAIL',
  'PUBLIC_SUPPORT_WHATSAPP',
];

const missingValues = requiredValues.filter((name) => !process.env[name]?.trim());
const invalidValues = [];

for (const name of ['PUBLIC_SUPABASE_URL', 'PUBLIC_SITE_URL']) {
  const value = process.env[name]?.trim();
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') invalidValues.push(`${name} must use HTTPS`);
  } catch {
    invalidValues.push(`${name} must be a valid URL`);
  }
}

if (process.env.PUBLIC_SUPPORT_EMAIL?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.PUBLIC_SUPPORT_EMAIL.trim())) {
  invalidValues.push('PUBLIC_SUPPORT_EMAIL must be a valid email address');
}

if (process.env.PUBLIC_SUPPORT_WHATSAPP?.trim()
  && process.env.PUBLIC_SUPPORT_WHATSAPP.replace(/\D/g, '').length < 7) {
  invalidValues.push('PUBLIC_SUPPORT_WHATSAPP must contain an international number with at least seven digits');
}

if (missingValues.length || invalidValues.length) {
  console.error('Launch configuration is incomplete.');
  if (missingValues.length) console.error(`Missing: ${missingValues.join(', ')}`);
  for (const message of invalidValues) console.error(message);
  process.exitCode = 1;
} else {
  console.log('Required public launch configuration is present and valid.');
}

if (!process.env.PUBLIC_UMAMI_SCRIPT_URL?.trim() || !process.env.PUBLIC_UMAMI_WEBSITE_ID?.trim()) {
  console.log('Optional Umami configuration is absent; analytics will be disabled.');
}
