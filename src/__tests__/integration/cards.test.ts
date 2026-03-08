import { FastifyInstance } from 'fastify';
import {
  getApp, cleanDb, closeApp,
  post, get, patch, del,
  createActiveAccount,
} from './helpers';

let app: FastifyInstance;

beforeAll(async () => { app = await getApp(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await closeApp(); });

async function activeAccountWithCard(cardOverrides: Record<string, unknown> = {}) {
  const account = await createActiveAccount(app);
  const { body: card } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
    type: 'VIRTUAL',
    cardholderName: 'Jane Doe',
    ...cardOverrides,
  });
  return { account, card };
}

describe('POST /api/v1/accounts/:id/cards', () => {
  it('creates virtual card as ACTIVE immediately', async () => {
    const account = await createActiveAccount(app);
    const { status, body } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL',
      cardholderName: 'Jane Doe',
    });

    expect(status).toBe(201);
    expect(body.status).toBe('ACTIVE');
    expect(body.type).toBe('VIRTUAL');
    expect(body.last4).toMatch(/^\d{4}$/);
    expect(body.maskedPan).toMatch(/\d{4}$/);
    expect(body.activatedAt).toBeTruthy();
    expect(body.accountId).toBe(account.id);
  });

  it('creates physical card as PENDING_ACTIVATION', async () => {
    const account = await createActiveAccount(app);
    const { status, body } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'PHYSICAL',
      cardholderName: 'Jane Doe',
      shippingAddress: {
        line1: '123 Main St', city: 'New York',
        state: 'NY', postalCode: '10001', country: 'US',
      },
    });

    expect(status).toBe(201);
    expect(body.status).toBe('PENDING_ACTIVATION');
    expect(body.type).toBe('PHYSICAL');
    expect(body.activatedAt).toBeNull();
  });

  it('rejects physical card without shippingAddress', async () => {
    const account = await createActiveAccount(app);
    const { status, body } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'PHYSICAL',
      cardholderName: 'Jane Doe',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('SHIPPING_ADDRESS_REQUIRED');
  });

  it('rejects card creation for INACTIVE account', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'INACT-1', firstName: 'J', lastName: 'D',
      email: 'inact@example.com', creditLimitCents: 10000,
    });

    const { status, body } = await post(app, `/api/v1/accounts/${acct.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane Doe',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('rejects card creation when KYC not VERIFIED', async () => {
    const { body: acct } = await post(app, '/api/v1/accounts', {
      externalRef: 'NOKYC-1', firstName: 'J', lastName: 'D',
      email: 'nokyc@example.com', creditLimitCents: 10000,
    });
    // Set ACTIVE but keep KYC PENDING
    await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'VERIFIED' });
    await patch(app, `/api/v1/accounts/${acct.id}`, { status: 'ACTIVE' });
    // Reset KYC back to PENDING
    await patch(app, `/api/v1/accounts/${acct.id}/kyc`, { kycStatus: 'PENDING' });

    const { status, body } = await post(app, `/api/v1/accounts/${acct.id}/cards`, {
      type: 'VIRTUAL', cardholderName: 'Jane Doe',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('KYC_NOT_VERIFIED');
  });

  it('rejects card for unknown account with 404', async () => {
    const { status } = await post(
      app,
      '/api/v1/accounts/00000000-0000-0000-0000-000000000000/cards',
      { type: 'VIRTUAL', cardholderName: 'Jane Doe' },
    );
    expect(status).toBe(404);
  });

  it('enforces card limit hierarchy: transaction <= daily <= creditLimit', async () => {
    const account = await createActiveAccount(app);

    // transactionLimitCents > dailyLimitCents
    const { status, body } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL',
      cardholderName: 'Jane Doe',
      dailyLimitCents: 10000,
      transactionLimitCents: 20000,
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT');
  });

  it('enforces daily limit <= account creditLimit', async () => {
    const account = await createActiveAccount(app); // creditLimitCents: 500000
    const { status, body } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'VIRTUAL',
      cardholderName: 'Jane Doe',
      dailyLimitCents: 600000,
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('DAILY_LIMIT_EXCEEDS_CREDIT_LIMIT');
  });
});

describe('GET /api/v1/cards/:id', () => {
  it('returns card details', async () => {
    const { account, card } = await activeAccountWithCard();
    const { status, body } = await get(app, `/api/v1/cards/${card.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(card.id);
    expect(body.accountId).toBe(account.id);
  });

  it('returns 404 for unknown card', async () => {
    const { status } = await get(app, '/api/v1/cards/00000000-0000-0000-0000-000000000000');
    expect(status).toBe(404);
  });
});

describe('Card state machine', () => {
  it('VIRTUAL full lifecycle: ACTIVE → INACTIVE ↔ ACTIVE → SUSPENDED → ACTIVE → CLOSED', async () => {
    const { card } = await activeAccountWithCard();
    expect(card.status).toBe('ACTIVE');

    // Deactivate
    const { body: inactive } = await post(app, `/api/v1/cards/${card.id}/deactivate`, {});
    expect(inactive.status).toBe('INACTIVE');

    // Reactivate from INACTIVE
    const { body: active1 } = await post(app, `/api/v1/cards/${card.id}/reactivate`, {});
    expect(active1.status).toBe('ACTIVE');

    // Suspend
    const { body: suspended } = await post(app, `/api/v1/cards/${card.id}/suspend`, {});
    expect(suspended.status).toBe('SUSPENDED');

    // Reactivate from SUSPENDED
    const { body: active2 } = await post(app, `/api/v1/cards/${card.id}/reactivate`, {});
    expect(active2.status).toBe('ACTIVE');

    // Close
    const { status: closeStatus, body: closed } = await del(app, `/api/v1/cards/${card.id}`);
    expect(closeStatus).toBe(200);
    expect(closed.status).toBe('CLOSED');
  });

  it('PHYSICAL: PENDING_ACTIVATION → ACTIVE via activate', async () => {
    const account = await createActiveAccount(app);
    const { body: physCard } = await post(app, `/api/v1/accounts/${account.id}/cards`, {
      type: 'PHYSICAL',
      cardholderName: 'Jane Doe',
      shippingAddress: { line1: '1 St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' },
    });
    expect(physCard.status).toBe('PENDING_ACTIVATION');

    const { body: activated } = await post(app, `/api/v1/cards/${physCard.id}/activate`, {});
    expect(activated.status).toBe('ACTIVE');
    expect(activated.activatedAt).toBeTruthy();
  });

  it('rejects activating an ACTIVE card', async () => {
    const { card } = await activeAccountWithCard();
    const { status, body } = await post(app, `/api/v1/cards/${card.id}/activate`, {});
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects deactivating an INACTIVE card', async () => {
    const { card } = await activeAccountWithCard();
    await post(app, `/api/v1/cards/${card.id}/deactivate`, {});
    const { status, body } = await post(app, `/api/v1/cards/${card.id}/deactivate`, {});
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects any transition from CLOSED', async () => {
    const { card } = await activeAccountWithCard();
    await del(app, `/api/v1/cards/${card.id}`);

    const { status } = await post(app, `/api/v1/cards/${card.id}/activate`, {});
    expect(status).toBe(422);
  });

  it('rejects closing already-closed card with 409', async () => {
    const { card } = await activeAccountWithCard();
    await del(app, `/api/v1/cards/${card.id}`);
    const { status, body } = await del(app, `/api/v1/cards/${card.id}`);
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });
});

describe('PATCH /api/v1/cards/:id', () => {
  it('updates cardholderName', async () => {
    const { card } = await activeAccountWithCard();
    const { status, body } = await patch(app, `/api/v1/cards/${card.id}`, { cardholderName: 'John Smith' });
    expect(status).toBe(200);
    expect(body.cardholderName).toBe('John Smith');
  });

  it('updates daily limit within credit limit', async () => {
    const { card } = await activeAccountWithCard();
    const { status, body } = await patch(app, `/api/v1/cards/${card.id}`, { dailyLimitCents: 100000 });
    expect(status).toBe(200);
    expect(body.dailyLimitCents).toBe(100000);
  });

  it('rejects daily limit exceeding credit limit', async () => {
    const { card } = await activeAccountWithCard(); // account creditLimitCents: 500000
    const { status, body } = await patch(app, `/api/v1/cards/${card.id}`, { dailyLimitCents: 600000 });
    expect(status).toBe(422);
    expect(body.error.code).toBe('DAILY_LIMIT_EXCEEDS_CREDIT_LIMIT');
  });

  it('rejects updating a closed card', async () => {
    const { card } = await activeAccountWithCard();
    await del(app, `/api/v1/cards/${card.id}`);
    const { status } = await patch(app, `/api/v1/cards/${card.id}`, { cardholderName: 'X' });
    expect(status).toBe(422);
  });
});

describe('GET /api/v1/accounts/:id/cards', () => {
  it('lists cards for an account', async () => {
    const account = await createActiveAccount(app);
    await post(app, `/api/v1/accounts/${account.id}/cards`, { type: 'VIRTUAL', cardholderName: 'J' });
    await post(app, `/api/v1/accounts/${account.id}/cards`, { type: 'VIRTUAL', cardholderName: 'J' });

    const { status, body } = await get(app, `/api/v1/accounts/${account.id}/cards`);
    expect(status).toBe(200);
    expect(body.data.length).toBe(2);
  });

  it('returns empty list for account with no cards', async () => {
    const account = await createActiveAccount(app);
    const { body } = await get(app, `/api/v1/accounts/${account.id}/cards`);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.hasMore).toBe(false);
  });
});
