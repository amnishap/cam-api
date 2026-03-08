import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { InjectOptions } from 'light-my-request';
import { buildApp } from '../../app';

// Must be set before config/app is imported
process.env.DATABASE_URL = 'postgresql://cam_user:cam_password@localhost:5432/cam_test_db';
process.env.API_KEY = 'cam-dev-secret-key-1234';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

export const TEST_API_KEY = 'cam-dev-secret-key-1234';
export const AUTH_HEADER = { Authorization: `Bearer ${TEST_API_KEY}` };

let appInstance: FastifyInstance | null = null;
let prismaInstance: PrismaClient | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export async function getPrisma(): Promise<PrismaClient> {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }
  return prismaInstance;
}

export async function cleanDb(): Promise<void> {
  const prisma = await getPrisma();
  // Delete in dependency order
  await prisma.cardSpendingLimit.deleteMany();
  await prisma.accountSpendingLimit.deleteMany();
  await prisma.card.deleteMany();
  await prisma.account.deleteMany();
}

export async function closeApp(): Promise<void> {
  if (appInstance) {
    await appInstance.close();
    appInstance = null;
  }
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function inject(app: FastifyInstance, opts: InjectOptions): Promise<{ status: number; body: any }> {
  const res = await app.inject(opts);
  return { status: res.statusCode, body: res.json() };
}

/** POST helper — returns parsed body and status */
export async function post(app: FastifyInstance, url: string, body: unknown) {
  return inject(app, {
    method: 'POST',
    url,
    headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
}

export async function get(app: FastifyInstance, url: string) {
  return inject(app, { method: 'GET', url, headers: AUTH_HEADER });
}

export async function patch(app: FastifyInstance, url: string, body: unknown) {
  return inject(app, {
    method: 'PATCH',
    url,
    headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
}

export async function put(app: FastifyInstance, url: string, body: unknown) {
  return inject(app, {
    method: 'PUT',
    url,
    headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
}

export async function del(app: FastifyInstance, url: string) {
  return inject(app, { method: 'DELETE', url, headers: AUTH_HEADER });
}

/** Create an account, verify KYC, and activate it — returns the account */
export async function createActiveAccount(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
) {
  const base = {
    externalRef: `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    firstName: 'Jane',
    lastName: 'Doe',
    email: `jane-${Date.now()}@example.com`,
    creditLimitCents: 500000,
    currency: 'USD',
    ...overrides,
  };

  const { body: acct } = await post(app, '/api/v1/accounts', base);
  await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'VERIFIED' });
  await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'ACTIVE' });
  const { body: active } = await get(app, `/api/v1/accounts/${acct.id}`);
  return active;
}
