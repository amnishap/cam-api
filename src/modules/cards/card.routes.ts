import { FastifyPluginAsync } from 'fastify';
import { CardService } from './card.service';
import { createCardSchema, updateCardSchema, cardIdParamSchema, lockCardSchema, unlockCardSchema, replaceCardSchema } from './card.schema';
import { CreateCardBody, UpdateCardBody } from './card.types';

const cardRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new CardService(fastify.db);

  // POST /accounts/:id/cards
  fastify.post<{ Params: { id: string }; Body: CreateCardBody }>(
    '/accounts/:id/cards',
    { schema: createCardSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const card = await service.create(request.params.id, request.body);
      return reply.status(201).send(card);
    },
  );

  // GET /cards/:id
  fastify.get<{ Params: { id: string } }>(
    '/cards/:id',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.getById(request.params.id);
    },
  );

  // PATCH /cards/:id
  fastify.patch<{ Params: { id: string }; Body: UpdateCardBody }>(
    '/cards/:id',
    { schema: updateCardSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.update(request.params.id, request.body);
    },
  );

  // POST /cards/:id/activate
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/activate',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.activate(request.params.id);
    },
  );

  // POST /cards/:id/deactivate
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/deactivate',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.deactivate(request.params.id);
    },
  );

  // POST /cards/:id/suspend
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/suspend',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.suspend(request.params.id);
    },
  );

  // POST /cards/:id/reactivate
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/reactivate',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.reactivate(request.params.id);
    },
  );

  // POST /cards/:id/lock
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/lock',
    { schema: lockCardSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.lock(request.params.id);
    },
  );

  // POST /cards/:id/unlock
  fastify.post<{ Params: { id: string } }>(
    '/cards/:id/unlock',
    { schema: unlockCardSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.unlock(request.params.id);
    },
  );

  // POST /cards/:id/replace
  fastify.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/cards/:id/replace',
    { schema: replaceCardSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const card = await service.replace(request.params.id, request.body.reason);
      return reply.status(201).send(card);
    },
  );

  // DELETE /cards/:id (soft close)
  fastify.delete<{ Params: { id: string } }>(
    '/cards/:id',
    { schema: cardIdParamSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const card = await service.close(request.params.id);
      return reply.status(200).send(card);
    },
  );
};

export default cardRoutes;
