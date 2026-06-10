import fetch from 'node-fetch';

const BASE = process.env.CJ_API_BASE || 'https://developers.cjdropshipping.com/api2.0';
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new Error('CJ_API_KEY not set');
  console.log('CJ: authenticating with apiKey...');
  const res = await fetch(`${BASE}/v1/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  const text = await res.text();
  console.log('CJ auth response:', text.slice(0, 300));
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('CJ auth invalid JSON: ' + text.slice(0, 100)); }
  if (!data.result) throw new Error('CJ auth failed: ' + data.message);
  _token = data.data.accessToken;
  _tokenExpiry = Date.now() + ((data.data.expiresIn || 1296000) - 60) * 1000;
  return _token;
}

async function cjRequest(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json', ...options.headers }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('CJ invalid JSON response: ' + text.slice(0, 100)); }
}

export async function getProduct(pid) {
  return cjRequest(`/v1/product/query?pid=${pid}`);
}

export async function searchProducts(query, page = 1, pageSize = 20, categoryId = '', sku = '') {
  let url = `/v1/product/list?pageNum=${page}&pageSize=${pageSize}`;
  if (query) url += `&productNameEn=${encodeURIComponent(query)}`;
  if (categoryId) url += `&categoryId=${encodeURIComponent(categoryId)}`;
  if (sku) url += `&productSku=${encodeURIComponent(sku)}`;
  const result = await cjRequest(url);
  console.log('CJ search result:', JSON.stringify(result).slice(0, 300));
  return result;
}

export async function getCategories() {
  return cjRequest('/v1/product/getCategory');
}

export async function getProductVariants(pid) {
  return cjRequest(`/v1/product/variant/query?pid=${pid}`);
}

export async function createOrder(orderData) {
  return cjRequest('/v1/shopping/order/createOrderV2', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
}

export async function getOrderStatus(orderId) {
  return cjRequest(`/v1/shopping/order/getOrderDetail?orderId=${orderId}`);
}

export async function getShippingRate(pid, country = 'NO', quantity = 1) {
  return cjRequest(`/v1/logistic/freightCalculate?startCountryCode=CN&endCountryCode=${country}&quantity=${quantity}&pid=${pid}`);
}

export async function getAvailableLogistics(pid, country = 'NO') {
  return cjRequest(`/v1/logistic/freightCalculate?startCountryCode=CN&endCountryCode=${country}&quantity=1&pid=${pid}`);
}
