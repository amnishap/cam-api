import { FastifyPluginAsync } from 'fastify';
import { LimitService, SpendingLimitInput } from './limit.service';
import {
  setAccountLimitsSchema,
  getAccountLimitsSchema,
  setCardLimitsSchema,
  getCardLimitsSchema,
} from './limit.schema';

const limitRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new LimitService(fastify.db);

  // PUT /accounts/:id/limits
  fastify.put<{ Params: { id: string }; Body: { limits: SpendingLimitInput[] } }>(
    '/accounts/:id/limits',
    { schema: setAccountLimitsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.setAccountLimits(request.params.id, request.body.limits);
    },
  );

  // GET /accounts/:id/limits
  fastify.get<{ Params: { id: string } }>(
    '/accounts/:id/limits',
    { schema: getAccountLimitsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.getAccountLimits(request.params.id);
    },
  );

  // PUT /cards/:id/limits
  fastify.put<{ Params: { id: string }; Body: { limits: SpendingLimitInput[] } }>(
    '/cards/:id/limits',
    { schema: setCardLimitsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.setCardLimits(request.params.id, request.body.limits);
    },
  );

  // GET /cards/:id/limits
  fastify.get<{ Params: { id: string } }>(
    '/cards/:id/limits',
    { schema: getCardLimitsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.getCardLimits(request.params.id);
    },
  );
};

export default limitRoutes;
