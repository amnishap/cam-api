import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyRequest {
    user: { apiKey: string };
  }
}

const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header. Expected: Bearer <api-key>',
          statusCode: 401,
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const token = authHeader.slice(7);
    if (token !== config.API_KEY) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
          statusCode: 401,
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }

    request.user = { apiKey: token };
  });
});

export default authPlugin;

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
