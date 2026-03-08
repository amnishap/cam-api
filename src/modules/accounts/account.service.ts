import { PrismaClient, AccountStatus, KycStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from '../../shared/errors';
import { buildPaginatedResult, PaginationParams } from '../../shared/utils/pagination';
import { CreateAccountBody, UpdateAccountBody, UpdateKycBody, ListAccountsQuery } from './account.types';

// Valid account status transitions
const ACCOUNT_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  INACTIVE: [AccountStatus.ACTIVE],
  ACTIVE: [AccountStatus.SUSPENDED, AccountStatus.CLOSED],
  SUSPENDED: [AccountStatus.ACTIVE, AccountStatus.CLOSED],
  CLOSED: [],
};

export class AccountService {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateAccountBody) {
    const existing = await this.db.account.findFirst({
      where: { OR: [{ email: data.email }, { externalRef: data.externalRef }] },
      select: { id: true, email: true, externalRef: true },
    });

    if (existing) {
      if (existing.email === data.email) {
        throw new ConflictError(`Account with email '${data.email}' already exists`);
      }
      throw new ConflictError(`Account with externalRef '${data.externalRef}' already exists`);
    }

    return this.db.account.create({
      data: {
        id: uuidv4(),
        externalRef: data.externalRef,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        taxId: data.taxId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        creditLimitCents: data.creditLimitCents,
        availableBalanceCents: data.creditLimitCents,
        statementBalanceCents: 0,
        currency: data.currency ?? 'USD',
        status: AccountStatus.INACTIVE,
        kycStatus: KycStatus.PENDING,
      },
    });
  }

  async list(
    query: ListAccountsQuery,
    pagination: PaginationParams,
  ) {
    const { cursor, limit = 20 } = pagination;
    const where: Prisma.AccountWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.kycStatus) where.kycStatus = query.kycStatus;

    const items = await this.db.account.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
    });

    return buildPaginatedResult(items, limit);
  }

  async getById(id: string) {
    const account = await this.db.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundError('Account', id);
    return account;
  }

  async update(id: string, data: UpdateAccountBody) {
    const account = await this.getById(id);

    if (data.status) {
      this.validateStatusTransition(account.status, data.status);
      // CLOSED is handled by the close() method
      if (data.status === AccountStatus.CLOSED) {
        throw new BusinessRuleError(
          'USE_CLOSE_ENDPOINT',
          'Use DELETE /accounts/:id to close an account',
        );
      }
    }

    if (data.creditLimitCents !== undefined) {
      await this.validateCreditLimitReduction(account, data.creditLimitCents);
    }

    if (data.creditLimitCents !== undefined) {
      return this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id} FOR UPDATE`;
        const current = await tx.account.findUnique({
          where: { id },
          select: { statementBalanceCents: true, creditLimitCents: true },
        });
        if (!current) throw new NotFoundError('Account', id);

        const delta = data.creditLimitCents! - current.creditLimitCents;
        return tx.account.update({
          where: { id },
          data: {
            ...this.buildUpdateData(data),
            availableBalanceCents: { increment: delta },
          },
        });
      });
    }

    return this.db.account.update({
      where: { id },
      data: this.buildUpdateData(data),
    });
  }

  async updateKyc(id: string, data: UpdateKycBody) {
    const account = await this.getById(id);
    if (account.status === AccountStatus.CLOSED) {
      throw new BusinessRuleError('ACCOUNT_CLOSED', 'Cannot update KYC for a closed account');
    }

    const updateData: Prisma.AccountUpdateInput = {
      kycStatus: data.kycStatus,
    };

    if (data.kycStatus === KycStatus.VERIFIED) {
      updateData.kycVerifiedAt = new Date();
    }

    return this.db.account.update({ where: { id }, data: updateData });
  }

  async close(id: string) {
    const account = await this.getById(id);

    if (account.status === AccountStatus.CLOSED) {
      throw new ConflictError('Account is already closed');
    }

    // Pre-conditions
    if (account.statementBalanceCents !== 0) {
      throw new BusinessRuleError(
        'OUTSTANDING_BALANCE',
        'Cannot close account with outstanding statement balance',
      );
    }

    const activeCards = await this.db.card.count({
      where: { accountId: id, status: { not: 'CLOSED' } },
    });

    if (activeCards > 0) {
      throw new BusinessRuleError(
        'ACTIVE_CARDS_EXIST',
        `Cannot close account: ${activeCards} card(s) must be closed first`,
      );
    }

    return this.db.account.update({
      where: { id },
      data: { status: AccountStatus.CLOSED },
    });
  }

  async getBalance(id: string) {
    const account = await this.db.account.findUnique({
      where: { id },
      select: {
        id: true,
        creditLimitCents: true,
        availableBalanceCents: true,
        statementBalanceCents: true,
        currency: true,
        updatedAt: true,
      },
    });
    if (!account) throw new NotFoundError('Account', id);
    return account;
  }

  async getCards(id: string, pagination: PaginationParams) {
    await this.getById(id);

    const { cursor, limit = 20 } = pagination;
    const items = await this.db.card.findMany({
      where: { accountId: id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
    });

    return buildPaginatedResult(items, limit);
  }

  private validateStatusTransition(current: AccountStatus, next: AccountStatus) {
    const allowed = ACCOUNT_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new BusinessRuleError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition account from ${current} to ${next}`,
      );
    }
  }

  private async validateCreditLimitReduction(
    account: { id: string; statementBalanceCents: number },
    newLimitCents: number,
  ) {
    if (newLimitCents < account.statementBalanceCents) {
      throw new BusinessRuleError(
        'CREDIT_LIMIT_BELOW_BALANCE',
        `New credit limit (${newLimitCents}) cannot be less than outstanding balance (${account.statementBalanceCents})`,
      );
    }

    // Validate all card per-transaction limits still fit within new account limit
    const cards = await this.db.card.findMany({
      where: { accountId: account.id, status: { not: 'CLOSED' } },
      select: { id: true, dailyLimitCents: true, monthlyLimitCents: true, transactionLimitCents: true },
    });

    for (const card of cards) {
      if (card.dailyLimitCents !== null && card.dailyLimitCents > newLimitCents) {
        throw new BusinessRuleError(
          'CARD_LIMIT_EXCEEDS_CREDIT_LIMIT',
          `Card ${card.id} daily limit (${card.dailyLimitCents}) exceeds new credit limit (${newLimitCents})`,
        );
      }
      if (card.monthlyLimitCents !== null && card.monthlyLimitCents > newLimitCents) {
        throw new BusinessRuleError(
          'CARD_LIMIT_EXCEEDS_CREDIT_LIMIT',
          `Card ${card.id} monthly limit (${card.monthlyLimitCents}) exceeds new credit limit (${newLimitCents})`,
        );
      }
    }
  }

  private buildUpdateData(data: UpdateAccountBody): Prisma.AccountUpdateInput {
    const update: Prisma.AccountUpdateInput = {};
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.addressLine1 !== undefined) update.addressLine1 = data.addressLine1;
    if (data.addressLine2 !== undefined) update.addressLine2 = data.addressLine2;
    if (data.city !== undefined) update.city = data.city;
    if (data.state !== undefined) update.state = data.state;
    if (data.postalCode !== undefined) update.postalCode = data.postalCode;
    if (data.country !== undefined) update.country = data.country;
    if (data.status !== undefined) update.status = data.status;
    if (data.creditLimitCents !== undefined) update.creditLimitCents = data.creditLimitCents;
    return update;
  }
}
