import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { config } from './config';
import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth';
import errorHandlerPlugin from './plugins/errorHandler';
import healthRoutes from './modules/health/health.routes';
import accountRoutes from './modules/accounts/account.routes';
import cardRoutes from './modules/cards/card.routes';
import limitRoutes from './modules/limits/limit.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            },
          }
        : {}),
    },
    genReqId: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ajv: {
      customOptions: {
        removeAdditional: false,
        useDefaults: true,
        coerceTypes: 'array', // coerce query-string integers; 'array' also handles array params
        allErrors: false,
      },
    },
  });

  // Plugins
  await fastify.register(helmet);
  await fastify.register(cors, { origin: config.CORS_ORIGIN });
  await fastify.register(databasePlugin);
  await fastify.register(authPlugin);
  await fastify.register(errorHandlerPlugin);

  // Routes — health at root level for load balancer access
  await fastify.register(healthRoutes);

  // API v1 routes
  await fastify.register(
    async (api) => {
      await api.register(accountRoutes, { prefix: '/accounts' });
      await api.register(cardRoutes);
      await api.register(limitRoutes);
    },
    { prefix: '/api/v1' },
  );

  return fastify;
}
