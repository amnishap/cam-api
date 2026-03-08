import 'dotenv/config';
import { setWorldConstructor, World, IWorldOptions, Before, After } from '@cucumber/cucumber';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

// Must be set before app/config is imported
process.env.DATABASE_URL = 'postgresql://cam_user:cam_password@localhost:5432/cam_test_db';
process.env.API_KEY = 'cam-dev-secret-key-1234';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Lazy-import to ensure env is set first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildApp } = require('../../src/app');

const AUTH = {
  Authorization: 'Bearer cam-dev-secret-key-1234',
  'content-type': 'application/json',
};

let sharedApp: FastifyInstance | null = null;
let sharedPrisma: PrismaClient | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!sharedApp) {
    sharedApp = await buildApp() as FastifyInstance;
    await sharedApp.ready();
  }
  return sharedApp!;
}

async function getPrisma(): Promise<PrismaClient> {
  if (!sharedPrisma) {
    sharedPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }
  return sharedPrisma;
}

export class CamWorld extends World {
  app!: FastifyInstance;

  // Scenario context
  accountId?: string;
  cardId?: string;
  lastStatus?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastBody?: any;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async setup() {
    this.app = await getApp();
    const prisma = await getPrisma();
    await prisma.cardSpendingLimit.deleteMany();
    await prisma.accountSpendingLimit.deleteMany();
    await prisma.card.deleteMany();
    await prisma.account.deleteMany();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async request(method: string, url: string, body?: unknown): Promise<{ status: number; body: any }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = { method, url, headers: AUTH };
    if (body !== undefined) opts.payload = JSON.stringify(body);
    const res = await this.app.inject(opts);
    this.lastStatus = res.statusCode;
    this.lastBody = res.json();
    return { status: res.statusCode, body: res.json() };
  }

  post(url: string, body: unknown) { return this.request('POST', url, body); }
  get(url: string)                 { return this.request('GET',  url); }
  patch(url: string, body: unknown){ return this.request('PATCH', url, body); }
  put(url: string, body: unknown)  { return this.request('PUT',   url, body); }
  del(url: string)                 { return this.request('DELETE', url); }

  /** Create an account, verify KYC, activate — returns the active account body */
  async createActiveAccount(overrides: Record<string, unknown> = {}) {
    const base = {
      externalRef: `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      firstName: 'Jane',
      lastName: 'Doe',
      email: `jane-${Date.now()}@example.com`,
      creditLimitCents: 500_000,
      currency: 'USD',
      ...overrides,
    };
    const { body: acct } = await this.post('/api/v1/accounts', base);
    await this.patch(`/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'VERIFIED' });
    await this.patch(`/api/v1/accounts/${acct.id}`, { status: 'ACTIVE' });
    const { body } = await this.get(`/api/v1/accounts/${acct.id}`);
    this.accountId = body.id;
    return body;
  }
}

setWorldConstructor(CamWorld);

Before(async function (this: CamWorld) {
  await this.setup();
});

After(async function () {
  // Keep app alive across scenarios for performance
});
