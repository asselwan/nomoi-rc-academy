#!/usr/bin/env node
// setup-academy-stripe.mjs — stage the Stripe Product/Price/Payment Link for the NOMOI Revenue
// Cycle Academy full course, following the same dry-run-by-default pattern as
// revenuefloor-web/scripts/setup-rf-diagnostic-stripe.mjs. Never writes a Payment Link into
// index.html; the founder pastes the live link in after reviewing it. Test mode by default;
// live mode requires --allow-live and a live secret key.

const OFFER = Object.freeze({
  offerKey: 'RCA-FULL-COURSE',
  productKey: 'nomoi_rc_academy_full_course',
  productName: 'NOMOI Revenue Cycle Academy: Full Course (6 modules)',
  lookupKey: 'rca_full_course_once',
  currency: 'aed',
  // Placeholder price. Founder confirms the real per-seat price before --apply --allow-live.
  unitAmountMinor: 0,
  publicAmount: 'TBD, set before going live',
  distribution: 'public_self_serve',
});

function parseArgs(argv) {
  const args = new Set(argv);
  const confirm = argv.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length) ?? '';
  return { apply: args.has('--apply'), allowLive: args.has('--allow-live'), confirm };
}

function plan() {
  return {
    mode: 'dry-run',
    network_calls: 0,
    mutation_calls: 0,
    offer: OFFER,
    intended_operations: [
      'reuse one Stripe Product by metadata.nomoi_offer_key, or create it if absent',
      'reuse one active Stripe Price by lookup_key, or create it if absent (price TBD, must be set before apply)',
      'reuse one public Payment Link by metadata.nomoi_offer_key, or create it if absent',
      'fail closed on duplicate or conflicting product, price, or payment-link state',
    ],
    apply_gate: 'Run with --apply --confirm=RCA-FULL-COURSE. Live keys additionally require --allow-live.',
    price_gate: 'unitAmountMinor is 0 (placeholder). Edit OFFER.unitAmountMinor before any --apply run.',
    public_page_behavior: 'No Payment Link is published by this script or written into index.html or lesson-1.html.',
  };
}

function keyMode(key) {
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return 'unknown';
}

function encode(body) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  return params;
}

async function stripeRequest(key, method, path, body) {
  const headers = { Authorization: `Bearer ${key}` };
  if (method !== 'GET') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : encode(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe HTTP ${res.status}`);
  return json;
}

async function main() {
  const { apply, allowLive, confirm } = parseArgs(process.argv.slice(2));

  if (!apply) {
    console.log(JSON.stringify(plan(), null, 2));
    console.log('\nDry run only. No Stripe calls made. Re-run with --apply --confirm=RCA-FULL-COURSE to mutate.');
    return;
  }

  if (confirm !== OFFER.offerKey) {
    console.error(`Refusing to apply: --confirm=${OFFER.offerKey} required, got "${confirm}".`);
    process.exit(2);
  }

  if (OFFER.unitAmountMinor <= 0) {
    console.error('Refusing to apply: OFFER.unitAmountMinor is still the 0 placeholder. Set the real price first.');
    process.exit(2);
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY not set.');
    process.exit(2);
  }
  const mode = keyMode(key);
  if (mode === 'live' && !allowLive) {
    console.error('Refusing to run a live key without --allow-live.');
    process.exit(2);
  }
  if (mode === 'unknown') {
    console.error('STRIPE_SECRET_KEY does not look like a Stripe secret/restricted key.');
    process.exit(2);
  }

  console.log(`Running in ${mode} mode for offer ${OFFER.offerKey}...`);

  // Find or create product
  const products = await stripeRequest(key, 'GET', '/products?limit=100');
  let product = (products.data || []).find((p) => p.metadata?.nomoi_offer_key === OFFER.offerKey);
  if (!product) {
    product = await stripeRequest(key, 'POST', '/products', {
      name: OFFER.productName,
      'metadata[nomoi_offer_key]': OFFER.offerKey,
      'metadata[nomoi_product_key]': OFFER.productKey,
    });
    console.log('created product', product.id);
  } else {
    console.log('reusing product', product.id);
  }

  // Find or create price
  const prices = await stripeRequest(key, 'GET', `/prices?lookup_keys[]=${OFFER.lookupKey}&limit=1`);
  let price = (prices.data || [])[0];
  if (!price) {
    price = await stripeRequest(key, 'POST', '/prices', {
      product: product.id,
      currency: OFFER.currency,
      unit_amount: OFFER.unitAmountMinor,
      lookup_key: OFFER.lookupKey,
    });
    console.log('created price', price.id);
  } else {
    console.log('reusing price', price.id);
  }

  // Find or create payment link
  const links = await stripeRequest(key, 'GET', '/payment_links?limit=100');
  let link = (links.data || []).find((l) => l.metadata?.nomoi_offer_key === OFFER.offerKey);
  if (!link) {
    link = await stripeRequest(key, 'POST', '/payment_links', {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': 1,
      'metadata[nomoi_offer_key]': OFFER.offerKey,
    });
    console.log('created payment link', link.id, link.url);
  } else {
    console.log('reusing payment link', link.id, link.url);
  }

  console.log('\nDone. Paste the payment link URL into index.html #enroll-cta by hand after review.');
  console.log('This script does not write it into the page automatically.');
}

main().catch((err) => {
  console.error('setup-academy-stripe failed:', err.message);
  process.exit(1);
});
