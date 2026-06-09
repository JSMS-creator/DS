import fetch from 'node-fetch';

const BASE = process.env.CJ_API_BASE || 'https://developers.cjdropshipping.com/api2.0';
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  console.log('CJ: authenticating with', process.env.CJ_EMAIL);
  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.CJ_EMAIL, password: process.env.CJ_PASSWORD })
  });
  const text = await res.text();
  console.log('CJ auth response:', text.slice(0, 300));
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('CJ auth invalid JSON: ' + text.slice(0, 100)); }
  if (!data.result) throw new Error('CJ auth failed: ' + data.message);
  _token = data.data.accessToken;
  _tokenExpiry = Date.now() + ((data.data.expiresIn || 3600) - 60) * 1000;
  return _token;
}

async function cjRequest(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json', ...options.headers }
  });
  return res.json();
}

export async function getProduct(pid) {
  return cjRequest(`/product/query?pid=${pid}`);
}

export async function searchProducts(query, page = 1, pageSize = 20) {
  return cjRequest(`/product/list?productNameEn=${encodeURIComponent(query)}&countryCode=NO&pageNum=${page}&pageSize=${pageSize}`);
}

export async function getProductVariants(pid) {
  return cjRequest(`/product/variant/query?pid=${pid}`);
}

export async function createOrder(orderData) {
  return cjRequest('/shopping/order/createOrderV2', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
}

export async function getOrderStatus(orderId) {
  return cjRequest(`/shopping/order/getOrderDetail?orderId=${orderId}`);
}

export async function getShippingRate(pid, country = 'NO', quantity = 1) {
  return cjRequest(`/logistic/freightCalculate?startCountryCode=DE&endCountryCode=${country}&quantity=${quantity}&pid=${pid}`);
}
