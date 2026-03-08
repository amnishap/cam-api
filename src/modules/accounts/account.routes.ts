import { FastifyPluginAsync } from 'fastify';
import { AccountService } from './account.service';
import {
  createAccountSchema,
  updateAccountSchema,
  updateKycSchema,
  idParamSchema,
  listAccountsSchema,
} from './account.schema';
import { CreateAccountBody, UpdateAccountBody, UpdateKycBody, ListAccountsQuery } from './account.types';
import { parsePaginationParams } from '../../shared/utils/pagination';

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AccountService(fastify.db);

  // POST /accounts
  fastify.post<{ Body: CreateAccountBody }>(
    '/',
    { schema: createAccountSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const account = await service.create(request.body);
      return reply.status(201).send(account);
    },
  );

  // GET /accounts
  fastify.get<{ Querystring: ListAccountsQuery }>(
    '/',
    { schema: listAccountsSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      const pagination = parsePaginationParams(request.query);
      return service.list(request.query, pagination);
    },
  );

  // GET /accounts/:id
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: idParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.getById(request.params.id);
    },
  );

  // PATCH /accounts/:id
  fastify.patch<{ Params: { id: string }; Body: UpdateAccountBody }>(
    '/:id',
    { schema: updateAccountSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.update(request.params.id, request.body);
    },
  );

  // DELETE /accounts/:id (soft close)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: idParamSchema, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const account = await service.close(request.params.id);
      return reply.status(200).send(account);
    },
  );

  // PATCH /accounts/:id/kyc
  fastify.patch<{ Params: { id: string }; Body: UpdateKycBody }>(
    '/:id/kyc',
    { schema: updateKycSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.updateKyc(request.params.id, request.body);
    },
  );

  // GET /accounts/:id/balance
  fastify.get<{ Params: { id: string } }>(
    '/:id/balance',
    { schema: idParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      return service.getBalance(request.params.id);
    },
  );

  // GET /accounts/:id/cards
  fastify.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/:id/cards',
    { schema: idParamSchema, preHandler: [fastify.authenticate] },
    async (request) => {
      const pagination = parsePaginationParams(request.query);
      return service.getCards(request.params.id, pagination);
    },
  );
};

export default accountRoutes;
