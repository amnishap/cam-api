import { CardService } from '../../modules/cards/card.service';
import { CardStatus, CardType, AccountStatus, KycStatus } from '@prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors';

const mockCard = (overrides = {}) => ({
  id: 'card-uuid-1',
  accountId: 'acct-uuid-1',
  type: CardType.VIRTUAL,
  status: CardStatus.ACTIVE,
  last4: '4242',
  maskedPan: '4*** **** **** 4242',
  network: 'VISA',
  expiryMonth: 12,
  expiryYear: 2027,
  cardholderName: 'Jane Doe',
  shippingAddress: null,
  dailyLimitCents: null,
  monthlyLimitCents: null,
  transactionLimitCents: null,
  activatedAt: new Date(),
  deactivatedAt: null,
  expiresAt: new Date('2027-12-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockAccount = (overrides = {}) => ({
  id: 'acct-uuid-1',
  status: AccountStatus.ACTIVE,
  kycStatus: KycStatus.VERIFIED,
  creditLimitCents: 100000,
  ...overrides,
});

function buildMockDb() {
  return {
    account: {
      findUnique: jest.fn(),
    },
    card: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('CardService', () => {
  let db: ReturnType<typeof buildMockDb>;
  let service: CardService;

  beforeEach(() => {
    db = buildMockDb();
    service = new CardService(db as never);
  });

  describe('create', () => {
    it('creates virtual card as ACTIVE immediately', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount());
      const created = mockCard({ status: CardStatus.ACTIVE, type: CardType.VIRTUAL });
      db.card.create.mockResolvedValue(created);

      const result = await service.create('acct-uuid-1', {
        type: CardType.VIRTUAL,
        cardholderName: 'Jane Doe',
      });

      expect(result.status).toBe(CardStatus.ACTIVE);
      expect(db.card.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CardStatus.ACTIVE,
            type: CardType.VIRTUAL,
          }),
        }),
      );
    });

    it('creates physical card as PENDING_ACTIVATION', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount());
      const created = mockCard({
        status: CardStatus.PENDING_ACTIVATION,
        type: CardType.PHYSICAL,
        shippingAddress: { line1: '123 Main St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' },
      });
      db.card.create.mockResolvedValue(created);

      const result = await service.create('acct-uuid-1', {
        type: CardType.PHYSICAL,
        cardholderName: 'Jane Doe',
        shippingAddress: { line1: '123 Main St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' },
      });

      expect(result.status).toBe(CardStatus.PENDING_ACTIVATION);
    });

    it('rejects creation for non-ACTIVE account', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.INACTIVE }));

      await expect(
        service.create('acct-uuid-1', { type: CardType.VIRTUAL, cardholderName: 'Jane Doe' }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('rejects creation when KYC not verified', async () => {
      db.account.findUnique.mockResolvedValue(
        mockAccount({ kycStatus: KycStatus.PENDING }),
      );

      await expect(
        service.create('acct-uuid-1', { type: CardType.VIRTUAL, cardholderName: 'Jane Doe' }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('requires shippingAddress for physical cards', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount());

      await expect(
        service.create('acct-uuid-1', { type: CardType.PHYSICAL, cardholderName: 'Jane Doe' }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('rejects card limit exceeding credit limit', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ creditLimitCents: 10000 }));

      await expect(
        service.create('acct-uuid-1', {
          type: CardType.VIRTUAL,
          cardholderName: 'Jane Doe',
          dailyLimitCents: 20000, // exceeds creditLimitCents: 10000
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('rejects transaction limit exceeding daily limit', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ creditLimitCents: 100000 }));

      await expect(
        service.create('acct-uuid-1', {
          type: CardType.VIRTUAL,
          cardholderName: 'Jane Doe',
          dailyLimitCents: 5000,
          transactionLimitCents: 8000, // exceeds dailyLimitCents: 5000
        }),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('activate', () => {
    it('activates a PENDING_ACTIVATION card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.PENDING_ACTIVATION }));
      db.card.update.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));

      const result = await service.activate('card-uuid-1');
      expect(result.status).toBe(CardStatus.ACTIVE);
    });

    it('rejects activating an already ACTIVE card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));

      await expect(service.activate('card-uuid-1')).rejects.toThrow(BusinessRuleError);
    });

    it('rejects activating a CLOSED card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.CLOSED }));

      await expect(service.activate('card-uuid-1')).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('deactivate', () => {
    it('deactivates an ACTIVE card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));
      db.card.update.mockResolvedValue(mockCard({ status: CardStatus.INACTIVE }));

      const result = await service.deactivate('card-uuid-1');
      expect(result.status).toBe(CardStatus.INACTIVE);
    });

    it('rejects deactivating already INACTIVE card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.INACTIVE }));

      await expect(service.deactivate('card-uuid-1')).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('reactivate', () => {
    it('reactivates an INACTIVE card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.INACTIVE }));
      db.card.update.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));

      const result = await service.reactivate('card-uuid-1');
      expect(result.status).toBe(CardStatus.ACTIVE);
    });

    it('reactivates a SUSPENDED card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.SUSPENDED }));
      db.card.update.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));

      const result = await service.reactivate('card-uuid-1');
      expect(result.status).toBe(CardStatus.ACTIVE);
    });
  });

  describe('close', () => {
    it('closes an active card', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.ACTIVE }));
      db.card.update.mockResolvedValue(mockCard({ status: CardStatus.CLOSED }));

      const result = await service.close('card-uuid-1');
      expect(result.status).toBe(CardStatus.CLOSED);
    });

    it('throws ConflictError if already closed', async () => {
      db.card.findUnique.mockResolvedValue(mockCard({ status: CardStatus.CLOSED }));

      await expect(service.close('card-uuid-1')).rejects.toThrow(ConflictError);
    });
  });

  describe('getById', () => {
    it('throws NotFoundError when card not found', async () => {
      db.card.findUnique.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });
});
