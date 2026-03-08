import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { CamWorld } from './world';

/* ─── Given ─── */

Given('I am a new customer with a ${int} credit limit', async function (this: CamWorld, limitDollars: number) {
  const { body } = await this.post('/api/v1/accounts', {
    externalRef: `EXT-${Date.now()}`,
    firstName: 'Jane',
    lastName: 'Doe',
    email: `jane-${Date.now()}@example.com`,
    creditLimitCents: limitDollars * 100,
    currency: 'USD',
  });
  this.accountId = body.id;
});

Given('I have an active account', async function (this: CamWorld) {
  await this.createActiveAccount();
});

Given('I have an active account with a virtual card', async function (this: CamWorld) {
  await this.createActiveAccount();
  const { body } = await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
    type: 'VIRTUAL',
    cardholderName: 'Jane Doe',
  });
  this.cardId = body.id;
});

Given('I have an active account with a ${int} credit limit and a virtual card',
  async function (this: CamWorld, limitDollars: number) {
    await this.createActiveAccount({ creditLimitCents: limitDollars * 100 });
    const { body } = await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
      type: 'VIRTUAL',
      cardholderName: 'Jane Doe',
    });
    this.cardId = body.id;
  },
);

/* ─── When ─── */

When('I verify my KYC', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}/kyc`, { kycStatus: 'VERIFIED' });
});

When('I activate my account', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { status: 'ACTIVE' });
});

When('I activate my account without KYC', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { status: 'ACTIVE' });
});

When('I try to activate my account directly', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { status: 'ACTIVE' });
});

When('I suspend the account', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { status: 'SUSPENDED' });
});

When('I unsuspend the account', async function (this: CamWorld) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { status: 'ACTIVE' });
});

When('I close the account', async function (this: CamWorld) {
  await this.del(`/api/v1/accounts/${this.accountId}`);
});

When('I try to close the account', async function (this: CamWorld) {
  await this.del(`/api/v1/accounts/${this.accountId}`);
});

When('I update the credit limit to ${int}', async function (this: CamWorld, limitDollars: number) {
  await this.patch(`/api/v1/accounts/${this.accountId}`, { creditLimitCents: limitDollars * 100 });
});

/* ─── Then ─── */

Then('the account status should be {string}', async function (this: CamWorld, status: string) {
  const { body } = await this.get(`/api/v1/accounts/${this.accountId}`);
  assert.strictEqual(body.status, status);
});

Then('the account KYC status should be {string}', async function (this: CamWorld, kycStatus: string) {
  const { body } = await this.get(`/api/v1/accounts/${this.accountId}`);
  assert.strictEqual(body.kycStatus, kycStatus);
});

Then('the account credit limit should be ${int}', async function (this: CamWorld, limitDollars: number) {
  const { body } = await this.get(`/api/v1/accounts/${this.accountId}`);
  assert.strictEqual(body.creditLimitCents, limitDollars * 100);
});

Then('the response status should be {int}', function (this: CamWorld, expectedStatus: number) {
  assert.strictEqual(this.lastStatus, expectedStatus);
});

Then('the error code should be {string}', function (this: CamWorld, code: string) {
  assert.strictEqual(this.lastBody?.error?.code, code);
});
