import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyError } from 'fastify';
import { AppError } from '../shared/errors';
import { Prisma } from '@prisma/client';

const errorHandlerPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    const timestamp = new Date().toISOString();

    // AppError subclasses (our domain errors)
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          requestId,
          timestamp,
        },
      });
    }

    // Prisma unique constraint violation (P2002)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const fields = (error.meta?.target as string[]) ?? [];
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: `Duplicate value for unique field(s): ${fields.join(', ')}`,
            statusCode: 409,
            requestId,
            timestamp,
          },
        });
      }

      if (error.code === 'P2025') {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
            statusCode: 404,
            requestId,
            timestamp,
          },
        });
      }

      fastify.log.error({ err: error, code: error.code }, 'Prisma known error');
      return reply.status(500).send({
        error: {
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
          statusCode: 500,
          requestId,
          timestamp,
        },
      });
    }

    // Fastify validation errors (JSON Schema via Ajv)
    const fastifyError = error as FastifyError;
    if (fastifyError.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: fastifyError.message,
          statusCode: 400,
          requestId,
          timestamp,
        },
      });
    }

    // Fastify 4xx errors
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: {
          code: 'CLIENT_ERROR',
          message: error.message,
          statusCode: error.statusCode,
          requestId,
          timestamp,
        },
      });
    }

    // Unhandled errors
    fastify.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        statusCode: 500,
        requestId,
        timestamp,
      },
    });
  });
});

export default errorHandlerPlugin;
