import { FastifyInstance } from 'fastify';
import {
  getApp, cleanDb, closeApp,
  post, get, put,
  createActiveAccount,
} from './helpers';

let app: FastifyInstance;

beforeAll(async () => { app = await getApp(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await closeApp(); });

describe('Account spending limits', () => {
  it('sets and retrieves DAILY limit', async () => {
    const account = await createActiveAccount(app);

    const { status, body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 200000 }],
    });

    expect(status).toBe(200);
    expect(body.accountId).toBe(account.id);
    expect(body.limits).toHaveLength(1);
    expect(body.limits[0].limitType).toBe('DAILY');
    expect(body.limits[0].valueCents).toBe(200000);
  });

  it('sets multiple limit types in one call', async () => {
    const account = await createActiveAccount(app);

    const { body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [
        { limitType: 'DAILY', valueCents: 200000 },
        { limitType: 'MONTHLY', valueCents: 400000 },
        { limitType: 'PER_TRANSACTION', valueCents: 50000 },
      ],
    });

    expect(body.limits).toHaveLength(3);
    expect(body.limits.map((l: { limitType: string }) => l.limitType).sort()).toEqual(
      ['DAILY', 'MONTHLY', 'PER_TRANSACTION'].sort(),
    );
  });

  it('upserts existing limit (idempotent)', async () => {
    const account = await createActiveAccount(app);

    await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 100000 }],
    });
    const { body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 200000 }],
    });

    expect(body.limits).toHaveLength(1);
    expect(body.limits[0].valueCents).toBe(200000);
  });

  it('sets MCC_BLOCK without valueCents', async () => {
    const account = await createActiveAccount(app);

    const { status, body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'MCC_BLOCK', mccCode: '5411' }],
    });

    expect(status).toBe(200);
    expect(body.limits[0].limitType).toBe('MCC_BLOCK');
    expect(body.limits[0].mccCode).toBe('5411');
  });

  it('sets multiple MCC_BLOCK entries for different MCCs', async () => {
    const account = await createActiveAccount(app);

    const { body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [
        { limitType: 'MCC_BLOCK', mccCode: '5411' },
        { limitType: 'MCC_BLOCK', mccCode: '7995' },
      ],
    });

    expect(body.limits).toHaveLength(2);
  });

  it('rejects DAILY limit exceeding credit limit', async () => {
    const account = await createActiveAccount(app); // creditLimitCents: 500000

    const { status, body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 600000 }],
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('LIMIT_EXCEEDS_CREDIT_LIMIT');
  });

  it('rejects MONTHLY limit exceeding credit limit', async () => {
    const account = await createActiveAccount(app);

    const { status, body } = await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'MONTHLY', valueCents: 999999 }],
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('LIMIT_EXCEEDS_CREDIT_LIMIT');
  });

  it('returns 404 for unknown account', async () => {
    const { status } = await put(
      app,
      '/api/v1/accounts/00000000-0000-0000-0000-000000000000/limits',
      { limits: [{ limitType: 'DAILY', valueCents: 1000 }] },
    );
    expect(status).toBe(404);
  });

  it('GET returns limits for account', async () => {
    const account = await createActiveAccount(app);
    await put(app, `/api/v1/accounts/${account.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 100000 }],
    });

    const { status, body } = await get(app, `/api/v1/accounts/${account.id}/limits`);
    expect(status).toBe(200);
    expect(body.limits).toHaveLength(1);
  });

  it('GET returns empty limits for new account', async () => {
    const account = await createActiveAccount(app);
    const { body } = await get(app, `/api/v1/accounts/${account.id}/limits`);
    expect(body.limits).toHaveLength(0);
  });
});

describe('Card spending limits', () => {
  async function accountWithCard() {
    const account = await createActiveAccount(app);
    const { body: card } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane Doe',
    });
    return { account, card };
  }

  it('sets and retrieves card DAILY limit', async () => {
    const { card } = await accountWithCard();

    const { status, body } = await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: 100000 }],
    });

    expect(status).toBe(200);
    expect(body.cardId).toBe(card.id);
    expect(body.limits[0].limitType).toBe('DAILY');
    expect(body.limits[0].valueCents).toBe(100000);
  });

  it('sets MCC_ALLOW on a card', async () => {
    const { card } = await accountWithCard();

    const { status, body } = await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'MCC_ALLOW', mccCode: '5812' }],
    });

    expect(status).toBe(200);
    expect(body.limits[0].mccCode).toBe('5812');
  });

  it('rejects card PER_TRANSACTION limit exceeding account credit limit', async () => {
    const { account, card } = await accountWithCard(); // creditLimitCents: 500000

    const { status, body } = await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'PER_TRANSACTION', valueCents: 600000 }],
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('LIMIT_EXCEEDS_CREDIT_LIMIT');
    // Suppress unused var warning
    void account;
  });

  it('upserts card limit (idempotent)', async () => {
    const { card } = await accountWithCard();

    await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'MONTHLY', valueCents: 200000 }],
    });
    const { body } = await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'MONTHLY', valueCents: 300000 }],
    });

    expect(body.limits).toHaveLength(1);
    expect(body.limits[0].valueCents).toBe(300000);
  });

  it('returns 404 for unknown card', async () => {
    const { status } = await put(
      app,
      '/api/v1/cards/00000000-0000-0000-0000-000000000000/limits',
      { limits: [{ limitType: 'DAILY', valueCents: 1000 }] },
    );
    expect(status).toBe(404);
  });

  it('GET returns empty limits for new card', async () => {
    const { card } = await accountWithCard();
    const { body } = await get(app, `/api/v1/cards/${card.id}/limits`);
    expect(body.limits).toHaveLength(0);
  });

  it('validates mccCode format (must be 4 digits)', async () => {
    const { card } = await accountWithCard();
    const { status } = await put(app, `/api/v1/cards/${card.id}/limits`, {
      limits: [{ limitType: 'MCC_BLOCK', mccCode: 'ABCD' }],
    });
    expect(status).toBe(400);
  });
});

describe('Credit limit reduction invalidates card limits', () => {
  it('rejects credit limit reduction below existing card daily limit', async () => {
    const account = await createActiveAccount(app, {
      externalRef: `CL-${Date.now()}`,
      email: `cl-reduce-${Date.now()}@example.com`,
      creditLimitCents: 500000,
    });

    // Create card with high daily limit
    const { body: card } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane', dailyLimitCents: 400000,
    });
    void card;

    // Try to reduce account credit limit below card's daily limit
    const { status, body } = await post(app, '/api/v1/accounts', {}).then(() =>
      // Use patch directly
      app.inject({
        method: 'PATCH',
        url: `/api/v1/accounts/${account.id}`,
        headers: { Authorization: 'Bearer cam-dev-secret-key-1234', 'content-type': 'application/json' },
        payload: { creditLimitCents: 300000 }, // below card's 400000 daily limit
      }).then(r => ({ status: r.statusCode, body: r.json() }))
    );

    expect(status).toBe(422);
    expect(body.error.code).toBe('CARD_LIMIT_EXCEEDS_CREDIT_LIMIT');
  });
});
