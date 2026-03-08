import { AccountService } from '../../modules/accounts/account.service';
import { AccountStatus, KycStatus } from '@prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors';

// Minimal mock account
const mockAccount = (overrides = {}) => ({
  id: 'acct-uuid-1',
  externalRef: 'EXT-001',
  status: AccountStatus.INACTIVE,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: null,
  dateOfBirth: null,
  taxId: null,
  kycStatus: KycStatus.PENDING,
  kycVerifiedAt: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  creditLimitCents: 100000,
  availableBalanceCents: 100000,
  statementBalanceCents: 0,
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function buildMockDb(overrides: Record<string, unknown> = {}) {
  return {
    account: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    card: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({
      $queryRaw: jest.fn(),
      account: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    })),
    ...overrides,
  };
}

describe('AccountService', () => {
  let db: ReturnType<typeof buildMockDb>;
  let service: AccountService;

  beforeEach(() => {
    db = buildMockDb();
    service = new AccountService(db as never);
  });

  describe('create', () => {
    it('creates a new account successfully', async () => {
      db.account.findFirst.mockResolvedValue(null);
      const created = mockAccount();
      db.account.create.mockResolvedValue(created);

      const result = await service.create({
        externalRef: 'EXT-001',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        creditLimitCents: 100000,
      });

      expect(result).toEqual(created);
      expect(db.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AccountStatus.INACTIVE,
            kycStatus: KycStatus.PENDING,
            availableBalanceCents: 100000,
            statementBalanceCents: 0,
          }),
        }),
      );
    });

    it('throws ConflictError when email already exists', async () => {
      db.account.findFirst.mockResolvedValue(mockAccount({ email: 'jane@example.com' }));

      await expect(
        service.create({
          externalRef: 'EXT-002',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          creditLimitCents: 100000,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when externalRef already exists', async () => {
      db.account.findFirst.mockResolvedValue(mockAccount({ email: 'other@example.com' }));

      await expect(
        service.create({
          externalRef: 'EXT-001',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'new@example.com',
          creditLimitCents: 100000,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getById', () => {
    it('returns account when found', async () => {
      const account = mockAccount();
      db.account.findUnique.mockResolvedValue(account);
      const result = await service.getById('acct-uuid-1');
      expect(result).toEqual(account);
    });

    it('throws NotFoundError when not found', async () => {
      db.account.findUnique.mockResolvedValue(null);
      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateKyc', () => {
    it('sets kycVerifiedAt when status becomes VERIFIED', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount());
      db.account.update.mockResolvedValue(mockAccount({ kycStatus: KycStatus.VERIFIED }));

      await service.updateKyc('acct-uuid-1', { kycStatus: KycStatus.VERIFIED });

      expect(db.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycStatus: KycStatus.VERIFIED,
            kycVerifiedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not set kycVerifiedAt for non-VERIFIED status', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount());
      db.account.update.mockResolvedValue(mockAccount({ kycStatus: KycStatus.REJECTED }));

      await service.updateKyc('acct-uuid-1', { kycStatus: KycStatus.REJECTED });

      expect(db.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { kycStatus: KycStatus.REJECTED },
        }),
      );
    });

    it('throws BusinessRuleError for closed account', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.CLOSED }));

      await expect(
        service.updateKyc('acct-uuid-1', { kycStatus: KycStatus.VERIFIED }),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('update - status transitions', () => {
    it('allows INACTIVE → ACTIVE transition', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.INACTIVE, kycStatus: KycStatus.VERIFIED }));
      db.account.update.mockResolvedValue(mockAccount({ status: AccountStatus.ACTIVE }));

      await service.update('acct-uuid-1', { status: AccountStatus.ACTIVE });
      expect(db.account.update).toHaveBeenCalled();
    });

    it('rejects INACTIVE → SUSPENDED transition', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.INACTIVE }));

      await expect(
        service.update('acct-uuid-1', { status: AccountStatus.SUSPENDED }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('rejects CLOSED → ACTIVE transition', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.CLOSED }));

      await expect(
        service.update('acct-uuid-1', { status: AccountStatus.ACTIVE }),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  describe('close', () => {
    it('throws ConflictError if already closed', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.CLOSED }));

      await expect(service.close('acct-uuid-1')).rejects.toThrow(ConflictError);
    });

    it('throws BusinessRuleError if outstanding balance', async () => {
      db.account.findUnique.mockResolvedValue(
        mockAccount({ status: AccountStatus.ACTIVE, statementBalanceCents: 5000 }),
      );

      await expect(service.close('acct-uuid-1')).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError if active cards exist', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.ACTIVE }));
      db.card.count.mockResolvedValue(2);

      await expect(service.close('acct-uuid-1')).rejects.toThrow(BusinessRuleError);
    });

    it('closes account when preconditions are met', async () => {
      db.account.findUnique.mockResolvedValue(mockAccount({ status: AccountStatus.ACTIVE }));
      db.card.count.mockResolvedValue(0);
      db.account.update.mockResolvedValue(mockAccount({ status: AccountStatus.CLOSED }));

      const result = await service.close('acct-uuid-1');
      expect(result.status).toBe(AccountStatus.CLOSED);
    });
  });
});
