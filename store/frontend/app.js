const API = 'http://localhost:3001/api';
const STRIPE_PK = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY'; // Replace with your key

let stripe, elements, paymentElement;
let currentProduct = null;
let selectedVariant = null;
let quantity = 1;
let clientSecret = null;
let priceBreakdown = null;

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  stripe = Stripe(STRIPE_PK);
  await loadProduct();
}

async function loadProduct() {
  try {
    const res = await fetch(`${API}/products`);
    const products = await res.json();
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
  renderModalSummary();

  const res = await fetch(`${API}/orders/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: currentProduct.cj_product_id,
      variantId: selectedVariant?.vid || null,
      quantity,
      customerInfo: {}
    })
  });
  const data = await res.json();
  if (data.error) { showPaymentMessage(data.error); return; }

  clientSecret = data.clientSecret;
  priceBreakdown = data.breakdown;
  renderModalSummary(priceBreakdown);

  elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#2563eb', borderRadius: '8px' } } });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
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
