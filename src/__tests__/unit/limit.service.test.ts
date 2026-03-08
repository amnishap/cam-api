import { LimitService } from '../../modules/limits/limit.service';
import { LimitType } from '@prisma/client';
import { BusinessRuleError, NotFoundError } from '../../shared/errors';

function buildMockDb() {
  return {
    account: {
      findUnique: jest.fn(),
    },
    card: {
      findUnique: jest.fn(),
    },
    accountSpendingLimit: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    cardSpendingLimit: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
      return fn({
        accountSpendingLimit: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        cardSpendingLimit: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      });
    }),
  };
}

describe('LimitService', () => {
  let db: ReturnType<typeof buildMockDb>;
  let service: LimitService;

  beforeEach(() => {
    db = buildMockDb();
    service = new LimitService(db as never);
  });

  describe('setAccountLimits', () => {
    it('throws NotFoundError when account not found', async () => {
      db.account.findUnique.mockResolvedValue(null);

      await expect(
        service.setAccountLimits('acct-uuid-1', [{ limitType: LimitType.DAILY, valueCents: 1000 }]),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when limit exceeds credit limit', async () => {
      db.account.findUnique.mockResolvedValue({ id: 'acct-uuid-1', creditLimitCents: 10000 });

      await expect(
        service.setAccountLimits('acct-uuid-1', [
          { limitType: LimitType.DAILY, valueCents: 50000 },
        ]),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('allows MCC_BLOCK without valueCents restriction', async () => {
      db.account.findUnique
        .mockResolvedValueOnce({ id: 'acct-uuid-1', creditLimitCents: 10000 })
        .mockResolvedValueOnce({ id: 'acct-uuid-1' });
      db.accountSpendingLimit.findMany.mockResolvedValue([]);

      // MCC_BLOCK doesn't need valueCents validation against credit limit
      await expect(
        service.setAccountLimits('acct-uuid-1', [
          { limitType: LimitType.MCC_BLOCK, mccCode: '5411' },
        ]),
      ).resolves.toBeDefined();
    });
  });

  describe('setCardLimits', () => {
    it('throws NotFoundError when card not found', async () => {
      db.card.findUnique.mockResolvedValue(null);

      await expect(
        service.setCardLimits('card-uuid-1', [{ limitType: LimitType.DAILY, valueCents: 1000 }]),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when card limit exceeds account credit limit', async () => {
      db.card.findUnique.mockResolvedValue({ id: 'card-uuid-1', accountId: 'acct-uuid-1' });
      db.account.findUnique.mockResolvedValue({ creditLimitCents: 5000 });

      await expect(
        service.setCardLimits('card-uuid-1', [
          { limitType: LimitType.MONTHLY, valueCents: 10000 },
        ]),
      ).rejects.toThrow(BusinessRuleError);
    });
  });
});
