import { When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { CamWorld } from './world';

/* ─── When ─── */

When('I request a {string} card on network {string}', async function (this: CamWorld, type: string, network: string) {
  const { body } = await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
    type,
    cardholderName: 'Jane Doe',
    network,
  });
  this.cardId = body.id;
});

When('I request a {string} card with shipping address', async function (this: CamWorld, type: string) {
  const { body } = await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
    type,
    cardholderName: 'Jane Doe',
    shippingAddress: { line1: '123 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' },
  });
  this.cardId = body.id;
});

When('I request a {string} card on network {string} without KYC', async function (this: CamWorld, type: string, network: string) {
  await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
    type,
    cardholderName: 'Jane Doe',
    network,
  });
});

When('I request a {string} card on an inactive account', async function (this: CamWorld, type: string) {
  // accountId is already set from "Given I am a new customer" — account is still INACTIVE
  await this.post(`/api/v1/accounts/${this.accountId}/cards`, {
    type,
    cardholderName: 'Jane Doe',
  });
});

When('I activate the card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/activate`, {});
});

When('I deactivate my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/deactivate`, {});
});

When('I reactivate my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/reactivate`, {});
});

When('I suspend my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/suspend`, {});
});

When('I lock my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/lock`, {});
});

When('I unlock my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/unlock`, {});
});

When('I try to lock my card again', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/lock`, {});
});

When('I try to lock my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/lock`, {});
});

When('I try to unlock my card', async function (this: CamWorld) {
  await this.post(`/api/v1/cards/${this.cardId}/unlock`, {});
});

When('I close my card', async function (this: CamWorld) {
  await this.del(`/api/v1/cards/${this.cardId}`);
});

When('I replace my card with reason {string}', async function (this: CamWorld, reason: string) {
  const { body } = await this.post(`/api/v1/cards/${this.cardId}/replace`, { reason });
  if (this.lastStatus === 201) this.newCardId = body.id;
});

When('I try to replace my card with reason {string}', async function (this: CamWorld, reason: string) {
  await this.post(`/api/v1/cards/${this.cardId}/replace`, { reason });
});

/* ─── Then ─── */

Then('the card status should be {string}', async function (this: CamWorld, status: string) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.status, status);
});

Then('the card status should still be {string}', async function (this: CamWorld, status: string) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.status, status);
});

Then('the card type should be {string}', async function (this: CamWorld, type: string) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.type, type);
});

Then('the card network should be {string}', async function (this: CamWorld, network: string) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.network, network);
});

Then('the card should be locked', async function (this: CamWorld) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.isLocked, true);
});

Then('the card should not be locked', async function (this: CamWorld) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.isLocked, false);
});

Then('a new card should be issued', async function (this: CamWorld) {
  assert.ok(this.newCardId, 'Expected a new card ID in the response');
  const { body } = await this.get(`/api/v1/cards/${this.newCardId}`);
  assert.notStrictEqual(body.id, this.cardId, 'New card should have a different ID');
});

Then('the original card should be closed', async function (this: CamWorld) {
  const { body } = await this.get(`/api/v1/cards/${this.cardId}`);
  assert.strictEqual(body.status, 'CLOSED');
});
