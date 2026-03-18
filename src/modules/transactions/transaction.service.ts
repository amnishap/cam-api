import { PrismaClient, TxnStatus, TxnType } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/NotFoundError';

interface ListFilters {
  status?:  TxnStatus;
  type?:    TxnType;
  cardId?:  string;
  from?:    string;
  to?:      string;
  cursor?:  string;
  limit:    number;
}

interface CreateTxnBody {
  cardId?:            string;
  type:               TxnType;
  amountCents:        number;
  currency?:          string;
  merchantName?:      string;
  merchantCategory?:  string;
  description?:       string;
  settleImmediately?: boolean;
}

export class TransactionService {
  constructor(private db: PrismaClient) {}

  async listByAccount(accountId: string, filters: ListFilters) {
    const account = await this.db.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundError('Account', accountId);
    return this.list({ accountId }, filters);
  }

  async listByCard(cardId: string, filters: ListFilters) {
    const card = await this.db.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundError('Card', cardId);
    return this.list({ cardId }, filters);
  }

  private async list(baseWhere: { accountId?: string; cardId?: string }, filters: ListFilters) {
    const { status, type, cardId, from, to, cursor, limit } = filters;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...baseWhere };
    if (status)  where.status = status;
    if (type)    where.type   = type;
    if (cardId && !baseWhere.cardId) where.cardId = cardId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const fetchLimit = limit + 1;
    if (cursor) {
      const pivot = await this.db.transaction.findUnique({ where: { id: cursor } });
      if (pivot) {
        where.AND = [
          { createdAt: { lte: pivot.createdAt } },
          { id: { not: pivot.id } },
        ];
      }
    }

    const items = await this.db.transaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: fetchLimit,
      include: { card: { select: { id: true, last4: true, type: true, network: true } } },
    });

    const hasMore = items.length > limit;
    const data    = hasMore ? items.slice(0, limit) : items;
    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? data[data.length - 1].id : null,
        count: data.length,
      },
    };
  }

  async create(accountId: string, body: CreateTxnBody) {
    const account = await this.db.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundError('Account', accountId);

    if (body.cardId) {
      const card = await this.db.card.findFirst({ where: { id: body.cardId, accountId } });
      if (!card) throw new NotFoundError('Card', body.cardId);
    }

    const now = new Date();
    return this.db.transaction.create({
      data: {
        accountId,
        cardId:           body.cardId ?? null,
        type:             body.type,
        status:           body.settleImmediately ? TxnStatus.SETTLED : TxnStatus.PENDING,
        amountCents:      body.amountCents,
        currency:         body.currency ?? account.currency,
        merchantName:     body.merchantName ?? null,
        merchantCategory: body.merchantCategory ?? null,
        description:      body.description ?? null,
        referenceId:      `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        settledAt:        body.settleImmediately ? now : null,
      },
      include: { card: { select: { id: true, last4: true, type: true, network: true } } },
    });
  }
}
