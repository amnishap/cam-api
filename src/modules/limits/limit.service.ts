import { PrismaClient, LimitType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, BusinessRuleError } from '../../shared/errors';

export interface SpendingLimitInput {
  limitType: LimitType;
  valueCents?: number | null;
  mccCode?: string;
}

export class LimitService {
  constructor(private readonly db: PrismaClient) {}

  async setAccountLimits(accountId: string, limits: SpendingLimitInput[]) {
    const account = await this.db.account.findUnique({
      where: { id: accountId },
      select: { id: true, creditLimitCents: true },
    });
    if (!account) throw new NotFoundError('Account', accountId);

    this.validateLimitsAgainstCreditLimit(limits, account.creditLimitCents);

    await this.db.$transaction(async (tx) => {
      for (const limit of limits) {
        const existing = await tx.accountSpendingLimit.findFirst({
          where: { accountId, limitType: limit.limitType, mccCode: limit.mccCode ?? null },
          select: { id: true },
        });
        if (existing) {
          await tx.accountSpendingLimit.update({
            where: { id: existing.id },
            data: { valueCents: limit.valueCents ?? null },
          });
        } else {
          await tx.accountSpendingLimit.create({
            data: {
              id: uuidv4(),
              accountId,
              limitType: limit.limitType,
              valueCents: limit.valueCents ?? null,
              mccCode: limit.mccCode ?? null,
            },
          });
        }

      }
    });

    return this.getAccountLimits(accountId);
  }

  async getAccountLimits(accountId: string) {
    const account = await this.db.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    });
    if (!account) throw new NotFoundError('Account', accountId);

    const limits = await this.db.accountSpendingLimit.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });

    return { accountId, limits };
  }

  async setCardLimits(cardId: string, limits: SpendingLimitInput[]) {
    const card = await this.db.card.findUnique({
      where: { id: cardId },
      select: { id: true, accountId: true },
    });
    if (!card) throw new NotFoundError('Card', cardId);

    const account = await this.db.account.findUnique({
      where: { id: card.accountId },
      select: { creditLimitCents: true },
    });
    if (!account) throw new NotFoundError('Account', card.accountId);

    this.validateLimitsAgainstCreditLimit(limits, account.creditLimitCents);

    await this.db.$transaction(async (tx) => {
      for (const limit of limits) {
        const existingCard = await tx.cardSpendingLimit.findFirst({
          where: { cardId, limitType: limit.limitType, mccCode: limit.mccCode ?? null },
          select: { id: true },
        });
        if (existingCard) {
          await tx.cardSpendingLimit.update({
            where: { id: existingCard.id },
            data: { valueCents: limit.valueCents ?? null },
          });
        } else {
          await tx.cardSpendingLimit.create({
            data: {
              id: uuidv4(),
              cardId,
              limitType: limit.limitType,
              valueCents: limit.valueCents ?? null,
              mccCode: limit.mccCode ?? null,
            },
          });
        }
      }
    });

    return this.getCardLimits(cardId);
  }

  async getCardLimits(cardId: string) {
    const card = await this.db.card.findUnique({
      where: { id: cardId },
      select: { id: true },
    });
    if (!card) throw new NotFoundError('Card', cardId);

    const limits = await this.db.cardSpendingLimit.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' },
    });

    return { cardId, limits };
  }

  private validateLimitsAgainstCreditLimit(
    limits: SpendingLimitInput[],
    creditLimitCents: number,
  ) {
    for (const limit of limits) {
      if (
        limit.valueCents != null &&
        ([LimitType.DAILY, LimitType.MONTHLY, LimitType.PER_TRANSACTION] as LimitType[]).includes(limit.limitType) &&
        limit.valueCents > creditLimitCents
      ) {
        throw new BusinessRuleError(
          'LIMIT_EXCEEDS_CREDIT_LIMIT',
          `${limit.limitType} limit (${limit.valueCents}) exceeds account credit limit (${creditLimitCents})`,
        );
      }
    }

    // Per-transaction must not exceed daily (when both are present in the same batch)
    const daily = limits.find(l => l.limitType === LimitType.DAILY)?.valueCents;
    const txn   = limits.find(l => l.limitType === LimitType.PER_TRANSACTION)?.valueCents;
    if (daily != null && txn != null && txn > daily) {
      throw new BusinessRuleError(
        'TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT',
        `Per-transaction limit (${txn}) cannot exceed daily limit (${daily})`,
      );
    }
  }
}
