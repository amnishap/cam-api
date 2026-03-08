import { FastifyInstance } from 'fastify';
import {
  getApp, cleanDb, closeApp,
  post, get, patch, del,
  createActiveAccount, AUTH_HEADER,
} from './helpers';

let app: FastifyInstance;

beforeAll(async () => { app = await getApp(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await closeApp(); });

describe('POST /api/v1/accounts', () => {
  it('creates account with INACTIVE status and PENDING KYC', async () => {
    const { status, body } = await post(app, '/api/v1/accounts', {
      externalRef: 'EXT-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      creditLimitCents: 100000,
    });

    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('INACTIVE');
    expect(body.kycStatus).toBe('PENDING');
    expect(body.creditLimitCents).toBe(100000);
    expect(body.availableBalanceCents).toBe(100000);
    expect(body.statementBalanceCents).toBe(0);
  });

  it('rejects duplicate email with 409', async () => {
    await post(app, '/api/v1/accounts', {
      externalRef: 'EXT-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'dupe@example.com',
      creditLimitCents: 10000,
    });

    const { status, body } = await post(app, '/api/v1/accounts', {
      externalRef: 'EXT-002',
      firstName: 'John',
      lastName: 'Doe',
      email: 'dupe@example.com',
      creditLimitCents: 10000,
    });

    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('rejects duplicate externalRef with 409', async () => {
    await post(app, '/api/v1/accounts', {
      externalRef: 'SAME-REF',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane1@example.com',
      creditLimitCents: 10000,
    });

    const { status, body } = await post(app, '/api/v1/accounts', {
      externalRef: 'SAME-REF',
      firstName: 'John',
      lastName: 'Doe',
      email: 'jane2@example.com',
      creditLimitCents: 10000,
    });

    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('rejects missing required fields with 400', async () => {
    const { status, body } = await post(app, '/api/v1/accounts', {
      firstName: 'Jane',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects negative creditLimitCents', async () => {
    const { status } = await post(app, '/api/v1/accounts', {
      externalRef: 'EXT-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      creditLimitCents: -100,
    });
    expect(status).toBe(400);
  });
});

describe('GET /api/v1/accounts', () => {
  it('returns paginated list', async () => {
    await post(app, '/api/v1/accounts', { externalRef: 'A1', firstName: 'A', lastName: 'A', email: 'a@example.com', creditLimitCents: 1000 });
    await post(app, '/api/v1/accounts', { externalRef: 'A2', firstName: 'B', lastName: 'B', email: 'b@example.com', creditLimitCents: 1000 });

    const { status, body } = await get(app, '/api/v1/accounts');
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.nextCursor).toBeNull();
  });

  it('filters by status', async () => {
    await createActiveAccount(app, { externalRef: 'ACT-1', email: 'active@example.com' });
    await post(app, '/api/v1/accounts', { externalRef: 'INACT-1', firstName: 'X', lastName: 'X', email: 'inactive@example.com', creditLimitCents: 1000 });

    const { body } = await get(app, '/api/v1/accounts?status=ACTIVE');
    expect(body.data.every((a: { status: string }) => a.status === 'ACTIVE')).toBe(true);
    expect(body.data.length).toBe(1);
  });

  it('cursor-based pagination works', async () => {
    for (let i = 0; i < 5; i++) {
      await post(app, '/api/v1/accounts', {
        externalRef: `EXT-${i}`, firstName: 'X', lastName: 'X',
        email: `user${i}@example.com`, creditLimitCents: 1000,
      });
    }

    const page1 = await get(app, '/api/v1/accounts?limit=3');
    expect(page1.body.data.length).toBe(3);
    expect(page1.body.pagination.hasMore).toBe(true);
    expect(page1.body.pagination.nextCursor).toBeTruthy();

    const page2 = await get(app, `/api/v1/accounts?limit=3&cursor=${page1.body.pagination.nextCursor}`);
    expect(page2.body.data.length).toBe(2);
    expect(page2.body.pagination.hasMore).toBe(false);

    // No duplicates across pages
    const ids1 = page1.body.data.map((a: { id: string }) => a.id);
    const ids2 = page2.body.data.map((a: { id: string }) => a.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
  });
});

describe('GET /api/v1/accounts/:id', () => {
  it('returns account by id', async () => {
    const { body: created } = await post(app, '/api/v1/accounts', {
      externalRef: 'EXT-001', firstName: 'Jane', lastName: 'Doe',
      email: 'jane@example.com', creditLimitCents: 50000,
    });

    const { status, body } = await get(app, `/api/v1/accounts/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
  });

  it('returns 404 for unknown id', async () => {
    const { status, body } = await get(app, '/api/v1/accounts/00000000-0000-0000-0000-000000000000');
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/v1/accounts/:id/kyc', () => {
  it('sets kycVerifiedAt when status becomes VERIFIED', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'KYC-1', firstName: 'J', lastName: 'D',
      email: 'kyc@example.com', creditLimitCents: 10000,
    });

    const { status, body } = await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'VERIFIED' });
    expect(status).toBe(200);
    expect(body.kycStatus).toBe('VERIFIED');
    expect(body.kycVerifiedAt).toBeTruthy();
  });

  it('can set status to REJECTED', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'KYC-2', firstName: 'J', lastName: 'D',
      email: 'kyc2@example.com', creditLimitCents: 10000,
    });

    const { status, body } = await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'REJECTED' });
    expect(status).toBe(200);
    expect(body.kycStatus).toBe('REJECTED');
    expect(body.kycVerifiedAt).toBeNull();
  });
});

describe('Account status state machine', () => {
  it('full lifecycle: INACTIVE → ACTIVE → SUSPENDED → ACTIVE → CLOSED', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'SM-1', firstName: 'J', lastName: 'D',
      email: 'sm@example.com', creditLimitCents: 10000,
    });
    expect(acct.status).toBe('INACTIVE');

    // KYC then activate
    await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'VERIFIED' });
    const { body: activated } = await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'ACTIVE' });
    expect(activated.status).toBe('ACTIVE');

    // Suspend
    const { body: suspended } = await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'SUSPENDED' });
    expect(suspended.status).toBe('SUSPENDED');

    // Reactivate
    const { body: reactivated } = await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'ACTIVE' });
    expect(reactivated.status).toBe('ACTIVE');

    // Close (no cards, no balance)
    const { status: closeStatus, body: closed } = await del(app, `/api/v1/accounts/${acct.id}`);
    expect(closeStatus).toBe(200);
    expect(closed.status).toBe('CLOSED');
  });

  it('rejects invalid transition INACTIVE → SUSPENDED', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'INV-1', firstName: 'J', lastName: 'D',
      email: 'inv@example.com', creditLimitCents: 10000,
    });

    const { status, body } = await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'SUSPENDED' });
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects closing account with outstanding balance', async () => {
    const account = await createActiveAccount(app);
    // Manually set a balance via Prisma
    const { getPrisma } = await import('./helpers');
    const prisma = await getPrisma();
    await prisma.account.update({
      where: { id: account.id },
      data: { statementBalanceCents: 5000 },
    });

    const { status, body } = await del(app, `/api/v1/accounts/${account.id}`);
    expect(status).toBe(422);
    expect(body.error.code).toBe('OUTSTANDING_BALANCE');
  });

  it('rejects closing account with non-closed cards', async () => {
    const account = await createActiveAccount(app);
    await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane Doe',
    });

    const { status, body } = await del(app, `/api/v1/accounts/${account.id}`);
    expect(status).toBe(422);
    expect(body.error.code).toBe('ACTIVE_CARDS_EXIST');
  });

  it('allows closing account after all cards are closed', async () => {
    const account = await createActiveAccount(app);
    const { body: card } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane Doe',
    });
    await del(app, `/api/v1/cards/${card.id}`);

    const { status, body } = await del(app, `/api/v1/accounts/${account.id}`);
    expect(status).toBe(200);
    expect(body.status).toBe('CLOSED');
  });
});

describe('Credit limit update', () => {
  it('updates credit limit and recalculates available balance', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'CL-1', firstName: 'J', lastName: 'D',
      email: 'cl@example.com', creditLimitCents: 100000,
    });

    const { body: updated } = await patch(app, `/api/v1/accounts/${acct.id}`, { creditLimitCents: 200000 });
    expect(updated.creditLimitCents).toBe(200000);
    expect(updated.availableBalanceCents).toBe(200000);
  });

  it('rejects reducing credit limit below statement balance', async () => {
    const account = await createActiveAccount(app, {
      externalRef: 'CL-2', email: 'cl2@example.com',
    });
    const { getPrisma } = await import('./helpers');
    const prisma = await getPrisma();
    await prisma.account.update({
      where: { id: account.id },
      data: { statementBalanceCents: 80000 },
    });

    const { status, body } = await patch(app, `/api/v1/accounts/${account.id}`, { creditLimitCents: 50000 });
    expect(status).toBe(422);
    expect(body.error.code).toBe('CREDIT_LIMIT_BELOW_BALANCE');
  });
});

describe('GET /api/v1/accounts/:id/balance', () => {
  it('returns balance details', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'BAL-1', firstName: 'J', lastName: 'D',
      email: 'bal@example.com', creditLimitCents: 250000,
    });

    const { status, body } = await get(app, `/api/v1/accounts/${acct.id}/balance`);
    expect(status).toBe(200);
    expect(body.creditLimitCents).toBe(250000);
    expect(body.availableBalanceCents).toBe(250000);
    expect(body.statementBalanceCents).toBe(0);
    expect(body.currency).toBe('USD');
  });
});

describe('Auth', () => {
  it('returns 401 without auth header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/accounts' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with wrong API key', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/accounts',
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.statusCode).toBe(401);
  });
});
