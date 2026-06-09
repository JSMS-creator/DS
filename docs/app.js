const API = null; // Demo mode — no backend needed
const STRIPE_PK = 'pk_test_demo';

// Demo product — replace with real API call when backend is deployed
const DEMO_PRODUCT = {
  cj_product_id: 'DEMO-DOG-COVER-001',
  name: 'PawGuard Bilseteovertrukk for Hund',
  description: `<ul>
    <li>🐾 Vanntett Oxford-stoff — beskytter mot smuss, hår og vann</li>
    <li>🔒 Hengekøye-design — holder hunden trygg og rolig under kjøring</li>
    <li>🚗 Universell passform — passer alle biler, SUV-er og varebiler</li>
    <li>🧺 Maskinvaskbar — enkelt å holde ren</li>
    <li>⚡ Enkel montering — festestropper på hodestøtter, ingen verktøy</li>
    <li>🌿 Slitesterk og langvarig — spar penger på bilseterens</li>
  </ul>
  <p>Perfekt for turer til hytta, skogstur eller daglig kjøring med hunden!</p>`,
  variants: [
    { vid: 'v1', variantNameEn: 'Svart — Standard', variantSellPrice: 319 },
    { vid: 'v2', variantNameEn: 'Grå — Standard', variantSellPrice: 319 },
    { vid: 'v3', variantNameEn: 'Svart — XL (SUV)', variantSellPrice: 359 }
  ],
  images: [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
    'https://images.unsplash.com/photo-1452378174528-3090a4bba7b2?w=800&q=80'
  ],
  sell_price_nok: 319,
  shipping_price_nok: 0
};

let stripe, elements, paymentElement;
let currentProduct = null;
let selectedVariant = null;
let quantity = 1;
let clientSecret = null;
let priceBreakdown = null;

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  await loadProduct();
}

async function loadProduct() {
  try {
    const products = [DEMO_PRODUCT];
    if (!products.length) return showError('Ingen produkter tilgjengelig.');
    renderProduct(products[0]);
  } catch {
    showError('Kunne ikke laste produkt. Prøv igjen.');
  }
}

function renderProduct(p) {
  currentProduct = p;

  document.getElementById('page-title').textContent = p.name + ' — ' + (window.STORE_NAME || 'Store');
  document.getElementById('page-desc').setAttribute('content', p.description?.replace(/<[^>]+>/g, '').slice(0, 150));
  document.getElementById('product-name').textContent = p.name;
  document.getElementById('price-display').textContent = 'NOK ' + formatPrice(totalPriceInclVat(p.sell_price_nok, p.shipping_price_nok));
  document.getElementById('footer-store-name').textContent = '© 2025 ' + (window.STORE_NAME || 'Store');
  document.getElementById('nav-logo').textContent = window.STORE_NAME || 'Store';

  // Images
  const images = p.images || [];
  const mainImg = document.getElementById('hero-main-img');
  if (images[0]) mainImg.src = images[0];
  const thumbContainer = document.getElementById('thumbnails');
  thumbContainer.innerHTML = '';
  images.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url; img.className = 'thumb' + (i === 0 ? ' active' : '');
    img.onclick = () => { mainImg.src = url; document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active')); img.classList.add('active'); };
    thumbContainer.appendChild(img);
  });

  // Description
  document.getElementById('product-description').innerHTML = p.description || '';

  // Variants
  const variants = p.variants || [];
  if (variants.length > 1) {
    document.getElementById('variants-section').style.display = 'block';
    renderVariants(variants);
  }
}

function renderVariants(variants) {
  const container = document.getElementById('variant-buttons');
  container.innerHTML = '';
  variants.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.className = 'variant-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = v.variantNameEn || v.name || v.id;
    btn.onclick = () => {
      selectedVariant = v;
      document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (v.variantSellPrice) {
        document.getElementById('price-display').textContent = 'NOK ' + formatPrice(totalPriceInclVat(v.variantSellPrice, currentProduct.shipping_price_nok));
      }
    };
    container.appendChild(btn);
  });
  if (variants[0]) selectedVariant = variants[0];
}

function changeQty(delta) {
  quantity = Math.max(1, Math.min(10, quantity + delta));
  document.getElementById('qty-display').textContent = quantity;
}

function totalPriceInclVat(sellPrice, shippingPrice) {
  const subtotal = sellPrice * quantity;
  const shipping = shippingPrice || 0;
  const vat = (subtotal + shipping) * 0.25;
  return subtotal + shipping + vat;
}

function formatPrice(n) { return Math.round(n).toLocaleString('no-NO'); }

// ── Checkout ─────────────────────────────────────────────────
async function initCheckout() {
  if (!currentProduct) return;
  openModal();

  const p = currentProduct;
  const sellPrice = selectedVariant?.variantSellPrice || p.sell_price_nok;
  const subtotal = sellPrice * quantity;
  const shipping = p.shipping_price_nok || 0;
  const vat = Math.round((subtotal + shipping) * 0.25);
  const total = subtotal + shipping + vat;
  priceBreakdown = { subtotal, shipping, vat, total };
  renderModalSummary(priceBreakdown);

  // Demo mode — show mock payment form
  document.getElementById('payment-element').innerHTML = `
    <div style="border:1.5px solid #e8e8e8;border-radius:8px;padding:16px;background:#fafafa;color:#666;font-size:0.9rem;text-align:center">
      🔒 Betalingsfelt (Stripe) — kobles til når du legger inn din Stripe-nøkkel
    </div>`;
}

function renderModalSummary(breakdown) {
  const p = currentProduct;
  const el = document.getElementById('modal-summary');
  if (!breakdown) {
    el.innerHTML = `<div class="summary-row"><span>${p?.name || 'Produkt'} × ${quantity}</span><span>Laster...</span></div>`;
    return;
  }
  el.innerHTML = `
    <div class="summary-row"><span>${p.name} × ${quantity}</span><span>NOK ${formatPrice(breakdown.subtotal)}</span></div>
    <div class="summary-row"><span>Frakt</span><span>${breakdown.shipping === 0 ? 'Gratis' : 'NOK ' + formatPrice(breakdown.shipping)}</span></div>
    <div class="summary-row"><span>MVA (25%)</span><span>NOK ${formatPrice(breakdown.vat)}</span></div>
    <div class="summary-row total"><span>Totalt</span><span>NOK ${formatPrice(breakdown.total)}</span></div>
  `;
}

async function submitPayment() {
  const name = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const address = document.getElementById('f-address').value.trim();
  const postal = document.getElementById('f-postal').value.trim();
  const city = document.getElementById('f-city').value.trim();

  if (!name || !email || !address || !postal || !city) {
    showPaymentMessage('Fyll inn alle leveringsfelter.');
    return;
  }

  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = 'Behandler...';
  showPaymentMessage('');

  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: window.location.origin + '/thank-you.html',
      receipt_email: email,
      shipping: {
        name,
        address: { line1: address, postal_code: postal, city, country: 'NO' }
      }
    }
  });

  if (error) {
    showPaymentMessage(error.message);
    btn.disabled = false;
    btn.textContent = 'Betal sikkert';
  }
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCheckout() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeCheckout();
}
function showPaymentMessage(msg) {
  document.getElementById('payment-message').textContent = msg;
}
function showError(msg) {
  document.getElementById('product-name').textContent = msg;
}

window.addEventListener('DOMContentLoaded', init);
window.changeQty = changeQty;
window.initCheckout = initCheckout;
window.submitPayment = submitPayment;
window.closeCheckout = closeCheckout;
window.closeModal = closeModal;
