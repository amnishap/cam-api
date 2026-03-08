import { FastifyInstance } from 'fastify';
import { getApp, closeApp } from './helpers';

let app: FastifyInstance;

beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await closeApp(); });

describe('Health endpoints', () => {
  it('GET /health returns 200 with uptime', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.timestamp).toBeTruthy();
  });

  it('GET /health/ready returns 200 with database connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });
});
