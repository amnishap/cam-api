import { FastifyPluginAsync } from 'fastify';
import { TransactionService } from './transaction.service';
import { createTransactionSchema, listTransactionsSchema, listCardTransactionsSchema } from './transaction.schema';

const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new TransactionService(fastify.db);

  // GET /accounts/:id/transactions
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/accounts/:id/transactions',
    { schema: listTransactionsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params;
      const q = request.query as Record<string, string>;
      return service.listByAccount(id, {
        status:  q.status  as never,
        type:    q.type    as never,
        cardId:  q.cardId,
        from:    q.from,
        to:      q.to,
        cursor:  q.cursor,
        limit:   Number(q.limit) || 20,
      });
    },
  );

  // GET /cards/:id/transactions
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/cards/:id/transactions',
    { schema: listCardTransactionsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params;
      const q = request.query as Record<string, string>;
      return service.listByCard(id, {
        status: q.status as never,
        type:   q.type   as never,
        from:   q.from,
        to:     q.to,
        cursor: q.cursor,
        limit:  Number(q.limit) || 20,
      });
    },
  );

  // POST /accounts/:id/transactions (simulate)
  fastify.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/accounts/:id/transactions',
    { schema: createTransactionSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const txn = await service.create(request.params.id, request.body as never);
      return reply.status(201).send(txn);
    },
  );
};

export default transactionRoutes;
