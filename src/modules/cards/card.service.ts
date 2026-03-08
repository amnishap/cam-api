import { PrismaClient, CardStatus, CardType, AccountStatus, KycStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from '../../shared/errors';
import { CreateCardBody, UpdateCardBody } from './card.types';

// Valid card status transitions
const CARD_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  PENDING_ACTIVATION: [CardStatus.ACTIVE, CardStatus.CLOSED],
  ACTIVE: [CardStatus.INACTIVE, CardStatus.SUSPENDED, CardStatus.CLOSED],
  INACTIVE: [CardStatus.ACTIVE, CardStatus.CLOSED],
  SUSPENDED: [CardStatus.ACTIVE, CardStatus.CLOSED],
  CLOSED: [],
};

function generateMockLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateMaskedPan(last4: string, network: string): string {
  const prefix = network === 'AMEX' ? '3' : '4';
  return `${prefix}*** **** **** ${last4}`;
}

function getExpiryDate(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear() + 3,
  };
}

export class CardService {
  constructor(private readonly db: PrismaClient) {}

  async create(accountId: string, data: CreateCardBody) {
    // KYC gate — must be ACTIVE + VERIFIED
    const account = await this.db.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        status: true,
        kycStatus: true,
        creditLimitCents: true,
      },
    });

    if (!account) throw new NotFoundError('Account', accountId);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BusinessRuleError(
        'ACCOUNT_NOT_ACTIVE',
        `Account must be ACTIVE to create a card (current status: ${account.status})`,
      );
    }

    if (account.kycStatus !== KycStatus.VERIFIED) {
      throw new BusinessRuleError(
        'KYC_NOT_VERIFIED',
        `Account KYC must be VERIFIED to create a card (current status: ${account.kycStatus})`,
      );
    }

    // Physical card requires shippingAddress
    if (data.type === CardType.PHYSICAL && !data.shippingAddress) {
      throw new BusinessRuleError(
        'SHIPPING_ADDRESS_REQUIRED',
        'Physical cards require a shippingAddress',
      );
    }

    this.validateCardLimitHierarchy(data, account.creditLimitCents);

    const last4 = generateMockLast4();
    const network = data.network ?? 'VISA';
    const maskedPan = generateMaskedPan(last4, network);
    const expiry = getExpiryDate();
    const isVirtual = data.type === CardType.VIRTUAL;

    const card = await this.db.card.create({
      data: {
        id: uuidv4(),
        accountId,
        type: data.type,
        status: isVirtual ? CardStatus.ACTIVE : CardStatus.PENDING_ACTIVATION,
        last4,
        maskedPan,
        network,
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        expiresAt: new Date(expiry.year, expiry.month - 1, 1),
        cardholderName: data.cardholderName,
        shippingAddress: data.shippingAddress ?? undefined,
        dailyLimitCents: data.dailyLimitCents ?? null,
        monthlyLimitCents: data.monthlyLimitCents ?? null,
        transactionLimitCents: data.transactionLimitCents ?? null,
        activatedAt: isVirtual ? new Date() : null,
      },
    });

    return card;
  }

  async getById(id: string) {
    const card = await this.db.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundError('Card', id);
    return card;
  }

  async update(id: string, data: UpdateCardBody) {
    const card = await this.getById(id);

    if (card.status === CardStatus.CLOSED) {
      throw new BusinessRuleError('CARD_CLOSED', 'Cannot update a closed card');
    }

    // Validate limits against account credit limit
    if (
      data.dailyLimitCents !== undefined ||
      data.monthlyLimitCents !== undefined ||
      data.transactionLimitCents !== undefined
    ) {
      const account = await this.db.account.findUnique({
        where: { id: card.accountId },
        select: { creditLimitCents: true },
      });
      if (!account) throw new NotFoundError('Account', card.accountId);

      const newDaily = data.dailyLimitCents !== undefined ? data.dailyLimitCents : card.dailyLimitCents;
      const newMonthly = data.monthlyLimitCents !== undefined ? data.monthlyLimitCents : card.monthlyLimitCents;
      const newTxn = data.transactionLimitCents !== undefined ? data.transactionLimitCents : card.transactionLimitCents;

      this.validateCardLimitHierarchy(
        { dailyLimitCents: newDaily ?? undefined, monthlyLimitCents: newMonthly ?? undefined, transactionLimitCents: newTxn ?? undefined },
        account.creditLimitCents,
      );
    }

    return this.db.card.update({
      where: { id },
      data: {
        ...(data.cardholderName !== undefined && { cardholderName: data.cardholderName }),
        ...(data.dailyLimitCents !== undefined && { dailyLimitCents: data.dailyLimitCents }),
        ...(data.monthlyLimitCents !== undefined && { monthlyLimitCents: data.monthlyLimitCents }),
        ...(data.transactionLimitCents !== undefined && { transactionLimitCents: data.transactionLimitCents }),
      },
    });
  }

  async activate(id: string) {
    return this.transition(id, CardStatus.ACTIVE, 'activate', (card) => {
      if (card.status !== CardStatus.PENDING_ACTIVATION) return;
      // Only physical cards go through PENDING_ACTIVATION
    });
  }

  async deactivate(id: string) {
    return this.transition(id, CardStatus.INACTIVE, 'deactivate');
  }

  async suspend(id: string) {
    return this.transition(id, CardStatus.SUSPENDED, 'suspend');
  }

  async reactivate(id: string) {
    return this.transition(id, CardStatus.ACTIVE, 'reactivate');
  }

  async lock(id: string) {
    const card = await this.getById(id);
    if (card.status === CardStatus.CLOSED) {
      throw new BusinessRuleError('CARD_CLOSED', 'Cannot lock a closed card');
    }
    if (card.isLocked) {
      throw new ConflictError('Card is already locked');
    }
    return this.db.card.update({ where: { id }, data: { isLocked: true } });
  }

  async unlock(id: string) {
    const card = await this.getById(id);
    if (card.status === CardStatus.CLOSED) {
      throw new BusinessRuleError('CARD_CLOSED', 'Cannot unlock a closed card');
    }
    if (!card.isLocked) {
      throw new ConflictError('Card is not locked');
    }
    return this.db.card.update({ where: { id }, data: { isLocked: false } });
  }

  async close(id: string) {
    const card = await this.getById(id);

    if (card.status === CardStatus.CLOSED) {
      throw new ConflictError('Card is already closed');
    }

    return this.db.card.update({
      where: { id },
      data: {
        status: CardStatus.CLOSED,
        deactivatedAt: new Date(),
      },
    });
  }

  async replace(id: string, reason: string) {
    const card = await this.getById(id);

    if (card.status === CardStatus.CLOSED) {
      throw new ConflictError('Cannot replace a closed card');
    }

    // Close the old card
    await this.db.card.update({
      where: { id },
      data: { status: CardStatus.CLOSED, deactivatedAt: new Date() },
    });

    // Issue replacement with same type, network, cardholder, and inherited limits
    const last4     = generateMockLast4();
    const maskedPan = generateMaskedPan(last4, card.network);
    const expiry    = getExpiryDate();
    const isVirtual = card.type === CardType.VIRTUAL;

    return this.db.card.create({
      data: {
        id: uuidv4(),
        accountId: card.accountId,
        type: card.type,
        status: isVirtual ? CardStatus.ACTIVE : CardStatus.PENDING_ACTIVATION,
        last4,
        maskedPan,
        network: card.network,
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        expiresAt: new Date(expiry.year, expiry.month - 1, 1),
        cardholderName: card.cardholderName,
        shippingAddress: card.shippingAddress ?? undefined,
        dailyLimitCents: card.dailyLimitCents,
        monthlyLimitCents: card.monthlyLimitCents,
        transactionLimitCents: card.transactionLimitCents,
        activatedAt: isVirtual ? new Date() : null,
      },
    });
  }

  private async transition(
    id: string,
    targetStatus: CardStatus,
    action: string,
    preCheck?: (card: Awaited<ReturnType<typeof this.getById>>) => void,
  ) {
    const card = await this.getById(id);

    preCheck?.(card);

    const allowed = CARD_TRANSITIONS[card.status];
    if (!allowed.includes(targetStatus)) {
      throw new BusinessRuleError(
        'INVALID_STATUS_TRANSITION',
        `Cannot ${action} card in status ${card.status}`,
      );
    }

    const updateData: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === CardStatus.ACTIVE && !card.activatedAt) {
      updateData.activatedAt = new Date();
    }
    if (targetStatus === CardStatus.INACTIVE || targetStatus === CardStatus.CLOSED) {
      updateData.deactivatedAt = new Date();
    }

    return this.db.card.update({ where: { id }, data: updateData });
  }

  private validateCardLimitHierarchy(
    limits: { dailyLimitCents?: number | null; monthlyLimitCents?: number | null; transactionLimitCents?: number | null },
    creditLimitCents: number,
  ) {
    const { dailyLimitCents, monthlyLimitCents, transactionLimitCents } = limits;

    if (dailyLimitCents != null && dailyLimitCents > creditLimitCents) {
      throw new BusinessRuleError(
        'DAILY_LIMIT_EXCEEDS_CREDIT_LIMIT',
        `Card daily limit (${dailyLimitCents}) exceeds account credit limit (${creditLimitCents})`,
      );
    }

    if (monthlyLimitCents != null && monthlyLimitCents > creditLimitCents) {
      throw new BusinessRuleError(
        'MONTHLY_LIMIT_EXCEEDS_CREDIT_LIMIT',
        `Card monthly limit (${monthlyLimitCents}) exceeds account credit limit (${creditLimitCents})`,
      );
    }

    if (transactionLimitCents != null) {
      if (dailyLimitCents != null && transactionLimitCents > dailyLimitCents) {
        throw new BusinessRuleError(
          'TRANSACTION_LIMIT_EXCEEDS_DAILY_LIMIT',
          `Card per-transaction limit (${transactionLimitCents}) exceeds daily limit (${dailyLimitCents})`,
        );
      }
      if (transactionLimitCents > creditLimitCents) {
        throw new BusinessRuleError(
          'TRANSACTION_LIMIT_EXCEEDS_CREDIT_LIMIT',
          `Card per-transaction limit (${transactionLimitCents}) exceeds account credit limit (${creditLimitCents})`,
        );
      }
    }
  }
}
