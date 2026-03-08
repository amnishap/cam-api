import { When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { CamWorld } from './world';

/* ─── When ─── */

When('I set account limits: monthly ${int}, daily ${int}, per-transaction ${int}',
  async function (this: CamWorld, monthly: number, daily: number, txn: number) {
    await this.put(`/api/v1/accounts/${this.accountId}/limits`, {
      limits: [
        { limitType: 'MONTHLY',         valueCents: monthly * 100 },
        { limitType: 'DAILY',           valueCents: daily   * 100 },
        { limitType: 'PER_TRANSACTION', valueCents: txn     * 100 },
      ],
    });
  },
);

When('I set card limits: monthly ${int}, daily ${int}, per-transaction ${int}',
  async function (this: CamWorld, monthly: number, daily: number, txn: number) {
    await this.put(`/api/v1/cards/${this.cardId}/limits`, {
      limits: [
        { limitType: 'MONTHLY',         valueCents: monthly * 100 },
        { limitType: 'DAILY',           valueCents: daily   * 100 },
        { limitType: 'PER_TRANSACTION', valueCents: txn     * 100 },
      ],
    });
  },
);

When('I try to set a card daily limit of ${int}',
  async function (this: CamWorld, limitDollars: number) {
    await this.put(`/api/v1/cards/${this.cardId}/limits`, {
      limits: [{ limitType: 'DAILY', valueCents: limitDollars * 100 }],
    });
  },
);

When('I try to set card limits: daily ${int}, per-transaction ${int}',
  async function (this: CamWorld, daily: number, txn: number) {
    await this.put(`/api/v1/cards/${this.cardId}/limits`, {
      limits: [
        { limitType: 'DAILY',           valueCents: daily * 100 },
        { limitType: 'PER_TRANSACTION', valueCents: txn   * 100 },
      ],
    });
  },
);

When('I block MCC {string} on the account', async function (this: CamWorld, mcc: string) {
  // Fetch existing limits first so we don't overwrite them
  const { body } = await this.get(`/api/v1/accounts/${this.accountId}/limits`);
  const existing = (body.limits ?? []).filter((l: { limitType: string }) => l.limitType !== 'MCC_BLOCK');
  await this.put(`/api/v1/accounts/${this.accountId}/limits`, {
    limits: [
      ...existing.map((l: { limitType: string; valueCents: number | null; mccCode: string | null }) => ({
        limitType: l.limitType,
        ...(l.valueCents != null && { valueCents: l.valueCents }),
        ...(l.mccCode    != null && { mccCode:    l.mccCode }),
      })),
      { limitType: 'MCC_BLOCK', mccCode: mcc },
    ],
  });
});

When('I block MCC {string} on the card', async function (this: CamWorld, mcc: string) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}/limits`);
  const existing = (body.limits ?? []).filter((l: { limitType: string }) => l.limitType !== 'MCC_BLOCK');
  await this.put(`/api/v1/cards/${this.cardId}/limits`, {
    limits: [
      ...existing.map((l: { limitType: string; valueCents: number | null; mccCode: string | null }) => ({
        limitType: l.limitType,
        ...(l.valueCents != null && { valueCents: l.valueCents }),
        ...(l.mccCode    != null && { mccCode:    l.mccCode }),
      })),
      { limitType: 'MCC_BLOCK', mccCode: mcc },
    ],
  });
});

/* ─── Then ─── */

Then('the account limits should include a monthly limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/accounts/${this.accountId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'MONTHLY');
    assert.ok(limit, 'MONTHLY limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the account limits should include a daily limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/accounts/${this.accountId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'DAILY');
    assert.ok(limit, 'DAILY limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the account limits should include a per-transaction limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/accounts/${this.accountId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'PER_TRANSACTION');
    assert.ok(limit, 'PER_TRANSACTION limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the card limits should include a monthly limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/cards/${this.cardId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'MONTHLY');
    assert.ok(limit, 'MONTHLY card limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the card limits should include a daily limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/cards/${this.cardId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'DAILY');
    assert.ok(limit, 'DAILY card limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the card limits should include a per-transaction limit of ${int}',
  async function (this: CamWorld, expectedDollars: number) {
    const { body } = await this.get(`/api/v1/cards/${this.cardId}/limits`);
    const limit = (body.limits ?? []).find((l: { limitType: string }) => l.limitType === 'PER_TRANSACTION');
    assert.ok(limit, 'PER_TRANSACTION card limit not found');
    assert.strictEqual(limit.valueCents, expectedDollars * 100);
  },
);

Then('the account MCC block list should contain {string}',
  async function (this: CamWorld, mcc: string) {
    const { body } = await this.get(`/api/v1/accounts/${this.accountId}/limits`);
    const blocked = (body.limits ?? [])
      .filter((l: { limitType: string }) => l.limitType === 'MCC_BLOCK')
      .map((l: { mccCode: string }) => l.mccCode);
    assert.ok(blocked.includes(mcc), `MCC ${mcc} not found in block list: ${JSON.stringify(blocked)}`);
  },
);

Then('the card MCC block list should contain {string}',
  async function (this: CamWorld, mcc: string) {
    const { body } = await this.get(`/api/v1/cards/${this.cardId}/limits`);
    const blocked = (body.limits ?? [])
      .filter((l: { limitType: string }) => l.limitType === 'MCC_BLOCK')
      .map((l: { mccCode: string }) => l.mccCode);
    assert.ok(blocked.includes(mcc), `MCC ${mcc} not found in card block list: ${JSON.stringify(blocked)}`);
  },
);
