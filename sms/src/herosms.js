// Thin wrapper around HeroSMS's SMS-Activate-compatible API
// (https://hero-sms.com/stubs/handler_api.php).
//
// When MOCK_MODE=true (or no API key is set), every function below returns
// realistic fake data instead of calling the real API, so you can build and
// test the whole site before your HeroSMS account is approved.

const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const MOCK_COUNTRIES = [
  { id: 0, eng: 'Russia' },
  { id: 1, eng: 'Ukraine' },
  { id: 6, eng: 'Indonesia' },
  { id: 12, eng: 'USA' },
  { id: 16, eng: 'United Kingdom' },
  { id: 43, eng: 'Germany' },
  { id: 78, eng: 'Nigeria' },
];

const MOCK_SERVICES = [
  { code: 'tg', name: 'Telegram' },
  { code: 'wa', name: 'WhatsApp' },
  { code: 'ig', name: 'Instagram' },
  { code: 'fb', name: 'Facebook' },
  { code: 'go', name: 'Google' },
  { code: 'tw', name: 'X / Twitter' },
  { code: 'ds', name: 'Discord' },
];

function isMock() {
  return String(process.env.MOCK_MODE).toLowerCase() === 'true' || !process.env.HEROSMS_API_KEY;
}

function apiKey() {
  return process.env.HEROSMS_API_KEY || '';
}

async function callLegacy(action, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('api_key', apiKey());
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text; // some legacy endpoints return plain strings like ACCESS_BALANCE:100.5
  }
}

// --- Public API -------------------------------------------------------

async function getBalance() {
  if (isMock()) return { balance: 250.0 };
  const raw = await callLegacy('getBalance');
  const str = String(raw);
  const amount = parseFloat(str.split(':')[1] || '0');
  return { balance: amount };
}

async function getCountries() {
  if (isMock()) return MOCK_COUNTRIES;
  const raw = await callLegacy('getCountries');
  return Object.values(raw).map((c) => ({ id: c.id, eng: c.eng }));
}

async function getServicesList(countryId) {
  if (isMock()) return MOCK_SERVICES;
  const raw = await callLegacy('getServicesList', { country: countryId });

  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && Array.isArray(raw.services)) {
    list = raw.services;
  } else if (raw && typeof raw === 'object') {
    list = Object.entries(raw)
      .filter(([key]) => !['success', 'status'].includes(key))
      .map(([code, value]) => ({
        code,
        name: typeof value === 'string' ? value : (value.name || value.eng || code),
      }));
  }

  return list.map((s) => ({ code: s.code, name: s.name || s.eng || s.code }));
}

// Returns raw cost (in HeroSMS's currency, before your markup) per country/service.
async function getPrices(serviceCode, countryId) {
  if (isMock()) {
    const base = 0.15 + ((serviceCode.charCodeAt(0) + Number(countryId || 0)) % 20) / 100;
    return { cost: Number(base.toFixed(2)), count: 50 + (Number(countryId || 0) * 7) % 500 };
  }
  const raw = await callLegacy('getPrices', { service: serviceCode, country: countryId });
  const countryBlock = raw?.[countryId];
  const serviceBlock = countryBlock?.[serviceCode];
  return { cost: serviceBlock?.cost ?? 0, count: serviceBlock?.count ?? 0 };
}

async function getNumber(serviceCode, countryId) {
  if (isMock()) {
    const fakeId = String(Date.now()).slice(-9);
    const fakeNumber = '1' + String(Math.floor(1000000000 + Math.random() * 8999999999));
    return {
      activationId: fakeId,
      phoneNumber: fakeNumber,
      activationCost: 0.2,
      status: 4,
    };
  }
  const raw = await callLegacy('getNumberV2', { service: serviceCode, country: countryId });
  if (typeof raw === 'string') throw new HeroSmsError(raw, raw);
  if (raw && raw.error) throw new HeroSmsError(raw.error, raw.message);
  return raw;
}

// Poll for the OTP. Mock mode "delivers" a code after ~8 seconds.
const mockActivationStart = new Map();

async function getStatus(activationId) {
  if (isMock()) {
    if (!mockActivationStart.has(activationId)) mockActivationStart.set(activationId, Date.now());
    const elapsed = Date.now() - mockActivationStart.get(activationId);
    if (elapsed > 8000) {
      const code = String(Math.floor(100000 + Math.random() * 899999));
      return {
        verificationType: 'sms',
        data: {
          id: activationId,
          phoneFrom: 'Service',
          code,
          text: `Your verification code is ${code}`,
          type: 'sms',
        },
      };
    }
    return { verificationType: 'sms', data: null };
  }
  const raw = await callLegacy('getStatusV2', { id: activationId });
  return raw;
}

// status: 3 = resend, 6 = finish (confirm code received), 8 = cancel/refund
async function setStatus(activationId, status) {
  if (isMock()) return 'ACCESS_ACTIVATION';
  return callLegacy('setStatus', { id: activationId, status });
}

class HeroSmsError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

module.exports = {
  isMock,
  getBalance,
  getCountries,
  getServicesList,
  getPrices,
  getNumber,
  getStatus,
  setStatus,
  HeroSmsError,
};