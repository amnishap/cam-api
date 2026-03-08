import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /health — liveness
  fastify.get('/health', { logLevel: 'silent' }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // GET /health/ready — readiness (DB ping)
  fastify.get('/health/ready', { logLevel: 'silent' }, async (request, reply) => {
    try {
      await fastify.db.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (err) {
      fastify.log.error({ err }, 'Health readiness check failed');
      return reply.status(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    }
  });
};

export default healthRoutes;
