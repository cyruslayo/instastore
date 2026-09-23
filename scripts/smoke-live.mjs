const baseUrl = process.env.BASE_URL?.trim();
const storeSlug = process.env.STORE_SLUG?.trim();

if (!baseUrl || !storeSlug) {
  console.error('Set BASE_URL and STORE_SLUG to run the public live smoke checks.');
  process.exit(2);
}

let origin;
try {
  origin = new URL(baseUrl);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error();
} catch {
  console.error('BASE_URL must be an HTTP or HTTPS URL.');
  process.exit(2);
}

const checks = [
  { path: '/', expected: 200 },
  { path: `/s/${encodeURIComponent(storeSlug)}`, expected: 200 },
  { path: `/s/${encodeURIComponent(storeSlug)}/shop`, expected: 200 },
  { path: '/s/instastore-smoke-invalid-store-404', expected: 404 },
  { path: '/admin', expected: 200 },
];

let failed = false;
for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, origin), {
      redirect: 'follow',
      headers: { 'user-agent': 'InstaStore-live-smoke/1.0' },
    });
    const passed = response.status === check.expected;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${check.path}: expected ${check.expected}, received ${response.status}`);
    if (!passed) failed = true;
  } catch (error) {
    console.error(`FAIL ${check.path}: ${error instanceof Error ? error.message : 'request failed'}`);
    failed = true;
  }
}

try {
  const response = await fetch(new URL('/shop?smoke=1', origin), { redirect: 'manual' });
  const location = response.headers.get('location') || '';
  const redirectPassed = response.status >= 300 && response.status < 400
    && location.includes(`/s/default-store/shop`)
    && location.includes('smoke=1');
  console.log(`${redirectPassed ? 'PASS' : 'FAIL'} /shop legacy redirect: ${response.status} ${location}`);
  if (!redirectPassed) failed = true;
} catch (error) {
  console.error(`FAIL /shop legacy redirect: ${error instanceof Error ? error.message : 'request failed'}`);
  failed = true;
}

if (failed) process.exitCode = 1;
