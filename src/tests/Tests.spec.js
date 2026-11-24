import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const BASE_URL = 'https://restful-booker.herokuapp.com';

// Rampa com 3 stages, iniciando com 7 VUs, pico de 92 VUs, duração total de 3,5 min (210s)
export const options = {
  startVUs: 7,
  stages: [
    { duration: '1m30s', target: 92 }, // Stage 1: rampa de subida (7 -> 92 VUs)
    { duration: '1m', target: 92 }, // Stage 2: carga sustentada no máximo (92 VUs)
    { duration: '1m', target: 0 } // Stage 3: rampa de descida
  ],
  thresholds: {
    // 90% das respostas com tempo abaixo de 6800ms
    http_req_duration: ['p(90)<6800'],
    // Menos de 25% das requisições com erro
    http_req_failed: ['rate<0.25'],
    // Pelo menos 75% dos checks devem passar
    checks: ['rate>0.75']
  }
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

// Executa uma vez: gera o token de autenticação
export function setup() {
  const res = http.post(
    `${BASE_URL}/auth`,
    JSON.stringify({ username: 'admin', password: 'password123' }),
    { headers: JSON_HEADERS }
  );

  check(res, { 'auth: status 200': r => r.status === 200 });
  return { token: res.json('token') };
}

export default function (data) {
  const payload = JSON.stringify({
    firstname: 'Teste',
    lastname: 'K6',
    totalprice: 150,
    depositpaid: true,
    bookingdates: { checkin: '2026-01-01', checkout: '2026-01-05' },
    additionalneeds: 'Breakfast'
  });

  let bookingId;

  group('Listar reservas', () => {
    const res = http.get(`${BASE_URL}/booking`);
    check(res, { 'list: status 200': r => r.status === 200 });
  });

  group('Criar reserva', () => {
    const res = http.post(`${BASE_URL}/booking`, payload, {
      headers: JSON_HEADERS
    });
    check(res, { 'create: status 200': r => r.status === 200 });
    bookingId = res.status === 200 ? res.json('bookingid') : null;
  });

  if (bookingId) {
    group('Consultar reserva', () => {
      const res = http.get(`${BASE_URL}/booking/${bookingId}`, {
        headers: JSON_HEADERS
      });
      check(res, { 'get: status 200': r => r.status === 200 });
    });

    group('Atualizar reserva', () => {
      const res = http.put(`${BASE_URL}/booking/${bookingId}`, payload, {
        headers: { ...JSON_HEADERS, Cookie: `token=${data.token}` }
      });
      check(res, { 'update: status 200': r => r.status === 200 });
    });
  }

  sleep(1);
}

// Gera o relatório HTML em src/output/index.html
export function handleSummary(data) {
  return {
    'src/output/index.html': htmlReport(data)
  };
}
