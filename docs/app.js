const API = 'https://thorough-charm-production-ecb9.up.railway.app/api';
const STRIPE_PK = 'pk_test_demo';

let stripe, elements, paymentElement;
let currentProduct = null;
let selectedVariant = null;
let quantity = 1;
let clientSecret = null;
let priceBreakdown = null;

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  await Promise.all([loadProduct(), loadSettings()]);
}

async function loadSettings() {
  try {
    const res = await fetch(`${API}/settings`);
    if (!res.ok) return;
    const s = await res.json();
    applySettings(s);
  } catch {
    // Settings are optional — silently skip
  }
}

function applySettings(s) {
  if (!s) return;

  // CSS vars
  const root = document.documentElement;
  if (s.primaryColor) root.style.setProperty('--black', s.primaryColor);
  if (s.buttonColor) root.style.setProperty('--btn-color', s.buttonColor);

  // Store name
  const storeName = s.storeName || window.STORE_NAME || 'Store';
  const navLogo = document.getElementById('nav-logo');
  if (navLogo) navLogo.textContent = storeName;
  const footerName = document.getElementById('footer-store-name');
  if (footerName) footerName.textContent = '© 2025 ' + storeName;
  const pageTitle = document.getElementById('page-title');
  if (pageTitle && pageTitle.textContent) {
    pageTitle.textContent = pageTitle.textContent.replace(/— .+$/, '— ' + storeName);
  }

  // Tagline
  if (s.tagline) {
    const taglineEl = document.getElementById('store-tagline');
    if (taglineEl) taglineEl.textContent = s.tagline;
  }

  // Social proof numbers
  if (s.soldCount) {
    const el = document.getElementById('sold-count');
    if (el) el.textContent = s.soldCount;
  }
  if (s.rating) {
    const el = document.getElementById('rating-value');
    if (el) el.textContent = s.rating;
  }
  if (s.deliveryDays) {
    document.querySelectorAll('.delivery-days').forEach(el => { el.textContent = s.deliveryDays; });
  }
  if (s.returnDays) {
    document.querySelectorAll('.return-days').forEach(el => { el.textContent = s.returnDays; });
  }

  // Benefits
  if (Array.isArray(s.benefits)) {
    const el = document.getElementById('benefits-list');
    if (el) {
      el.innerHTML = s.benefits.map(b => `<li>✅ ${b}</li>`).join('');
    }
  }

  // Reviews
  if (Array.isArray(s.reviews) && s.reviews.length) {
    const el = document.getElementById('reviews-list');
    if (el) {
      el.innerHTML = s.reviews.map(r => `
        <div class="review-card">
          <div class="review-stars">${'★'.repeat(Math.max(1, Math.min(5, r.stars || 5)))}</div>
          <p class="review-text">${r.text || ''}</p>
          <span class="review-author">${r.name || ''}</span>
        </div>
      `).join('');
    }
  }

  // FAQ
  if (Array.isArray(s.faq) && s.faq.length) {
    const el = document.getElementById('faq-list');
    if (el) {
      el.innerHTML = s.faq.map(item => `
        <details class="faq-item">
          <summary>${item.q || ''}</summary>
          <p>${item.a || ''}</p>
        </details>
      `).join('');
    }
  }
}

async function loadProduct() {
  try {
    const res = await fetch(`${API}/products`);
    if (!res.ok) throw new Error('Backend utilgjengelig');
    const products = await res.json();
    if (!products.length) return showError('Ingen aktive produkter. Legg til et produkt i admin.');
    renderProduct(products[0]);
  } catch {
    showError('Kunne ikke laste produkt. Sjekk at backend er oppe og at et produkt er aktivert i admin.');
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
    img.onerror = () => { img.style.display = 'none'; };
    img.onload = () => { if (i === 0) mainImg.src = url; };
    img.onclick = () => { mainImg.src = url; document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active')); img.classList.add('active'); };
    thumbContainer.appendChild(img);
  });
  // Main image fallback: if first fails, use first that loads
  mainImg.onerror = () => { const first = thumbContainer.querySelector('img[style=""],.thumb'); if (first) mainImg.src = first.src; };

  // Description
  document.getElementById('product-description').innerHTML = p.description || '';

  // Variants
  const variants = p.variants || [];
  if (variants.length > 1) {
    document.getElementById('variants-section').style.display = 'block';
    renderVariants(variants);
  }
}

// Extract size token from end of variant name (e.g. "... Light Blue XL" → "XL")
const SIZE_RE = /\b(\d{0,2}X{1,3}L|XS|[LMSX])\s*$/i;

function stripProductName(name, productName) {
  if (!name) return name;
  const escaped = (productName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return name.replace(new RegExp('^' + escaped + '\\s*', 'i'), '').trim() || name;
}

function parseVariant(v) {
  const raw = stripProductName(v.variantNameEn || v.name || '', currentProduct?.name);
  const sizeMatch = raw.match(SIZE_RE);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : null;
  const color = size ? raw.slice(0, raw.lastIndexOf(sizeMatch[0])).trim() : raw;
  return { raw, color: color || raw, size };
}

function renderVariants(variants) {
  const container = document.getElementById('variant-buttons');
  container.innerHTML = '';

  const parsed = variants.map(v => ({ v, ...parseVariant(v) }));
  const hasSizes = parsed.some(p => p.size);
  const hasColors = new Set(parsed.map(p => p.color)).size > 1;

  // If variants have both color and size dimensions — show two-level selector
  if (hasSizes && hasColors) {
    const colors = [...new Set(parsed.map(p => p.color))];
    const sizes  = [...new Set(parsed.map(p => p.size).filter(Boolean))];

    let selectedColor = colors[0];
    let selectedSize  = sizes[0];

    function pickVariant() {
      const match = parsed.find(p => p.color === selectedColor && p.size === selectedSize)
                 || parsed.find(p => p.color === selectedColor)
                 || parsed[0];
      selectedVariant = match.v;
      if (match.v.variantSellPrice)
        document.getElementById('price-display').textContent = 'NOK ' + formatPrice(totalPriceInclVat(match.v.variantSellPrice, currentProduct.shipping_price_nok));
      if (match.v.variantImage) {
        const mainImg = document.getElementById('hero-main-img');
        mainImg.src = match.v.variantImage;
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        const th = [...document.querySelectorAll('.thumb')].find(t => t.src === match.v.variantImage);
        if (th) th.classList.add('active');
      }
    }

    function render() {
      container.innerHTML = '';

      // Color row
      const colorLabel = document.createElement('div');
      colorLabel.style.cssText = 'font-size:0.82rem;font-weight:600;color:#555;margin-bottom:6px';
      colorLabel.textContent = 'Farge: ' + selectedColor;
      container.appendChild(colorLabel);

      const colorRow = document.createElement('div');
      colorRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px';
      colors.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'variant-btn' + (c === selectedColor ? ' selected' : '');
        btn.textContent = c;
        btn.style.cssText = 'font-size:0.8rem;padding:5px 12px';
        btn.onclick = () => { selectedColor = c; render(); pickVariant(); };
        colorRow.appendChild(btn);
      });
      container.appendChild(colorRow);

      // Size row
      const sizeLabel = document.createElement('div');
      sizeLabel.style.cssText = 'font-size:0.82rem;font-weight:600;color:#555;margin-bottom:6px';
      sizeLabel.textContent = 'Størrelse:';
      container.appendChild(sizeLabel);

      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
      sizes.forEach(s => {
        const available = parsed.some(p => p.color === selectedColor && p.size === s);
        const btn = document.createElement('button');
        btn.className = 'variant-btn' + (s === selectedSize ? ' selected' : '');
        btn.textContent = s;
        btn.style.cssText = 'font-size:0.85rem;padding:5px 14px' + (!available ? ';opacity:0.35;cursor:default' : '');
        btn.disabled = !available;
        btn.onclick = () => { if (available) { selectedSize = s; render(); pickVariant(); } };
        sizeRow.appendChild(btn);
      });
      container.appendChild(sizeRow);
    }

    render();
    pickVariant();
    return;
  }

  // Fallback: simple buttons (no size/color split)
  variants.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.className = 'variant-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = stripProductName(v.variantNameEn || v.name || v.id, currentProduct?.name);
    btn.onclick = () => {
      selectedVariant = v;
      document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (v.variantSellPrice)
        document.getElementById('price-display').textContent = 'NOK ' + formatPrice(totalPriceInclVat(v.variantSellPrice, currentProduct.shipping_price_nok));
      if (v.variantImage) {
        const mainImg = document.getElementById('hero-main-img');
        mainImg.src = v.variantImage;
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        const match = [...document.querySelectorAll('.thumb')].find(t => t.src === v.variantImage);
        if (match) match.classList.add('active');
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

function goHome(e, hash) {
  const successVisible = document.getElementById('order-success')?.style.display !== 'none';
  if (successVisible) {
    e.preventDefault();
    location.href = location.pathname + (hash || '');
  }
}

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

  // Demo mode — show demo notice instead of Stripe
  document.getElementById('payment-element').innerHTML = `
    <div style="border:1.5px solid #fde68a;border-radius:8px;padding:14px 16px;background:#fffbeb;color:#92400e;font-size:0.88rem">
      🧪 <strong>Demo-modus:</strong> Ingen ekte betaling — trykk "Betal sikkert" for å teste hele ordreflyten (CJ-ordre + e-post).
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

  try {
    const res = await fetch(`${API}/orders/demo-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: currentProduct.cj_product_id,
        variantId: selectedVariant?.variantSku || selectedVariant?.variantNameEn || '',
        quantity,
        name, email, address, postal, city
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showPaymentMessage(data.error || 'Noe gikk galt.');
      btn.disabled = false;
      btn.textContent = 'Betal sikkert';
      return;
    }
    closeCheckout();
    showOrderSuccess(name, email, data.total, data.emailError, data.cjError);
  } catch (e) {
    showPaymentMessage('Nettverksfeil. Prøv igjen.');
    btn.disabled = false;
    btn.textContent = 'Betal sikkert';
  }
}

function showOrderSuccess(name, email, total, emailError, cjError) {
  document.getElementById('product-section').style.display = 'none';
  const el = document.getElementById('order-success');
  if (el) {
    el.style.display = 'block';
    const nameEl = document.getElementById('success-name');
    const emailEl = document.getElementById('success-email');
    const totalEl = document.getElementById('success-total');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (totalEl) totalEl.textContent = 'NOK ' + formatPrice(total);
    // Show debug warnings if something failed (only visible in dev/demo)
    const debugEl = document.getElementById('success-debug');
    if (debugEl) {
      const msgs = [];
      if (emailError) msgs.push('⚠️ E-post feil: ' + emailError);
      if (cjError) msgs.push('⚠️ CJ-feil: ' + cjError);
      debugEl.style.display = msgs.length ? 'block' : 'none';
      debugEl.textContent = msgs.join(' | ');
    }
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
window.goHome = goHome;
