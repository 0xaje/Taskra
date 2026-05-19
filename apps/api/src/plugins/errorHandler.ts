import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const errorHandlerPlugin: FastifyPluginAsync = fp(async (server: FastifyInstance) => {
  server.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    // 1. Log the error using Fastify structured logger
    request.log.error(error);

    // 2. Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Input validation failed',
        details: error.format(),
      });
    }

    // 3. Handle custom application errors
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    // 4. Handle Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
        details: error.validation,
      });
    }

    // 5. Fallback for unexpected internal errors
    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(error.statusCode || 500).send({
      statusCode: error.statusCode || 500,
      error: 'Internal Server Error',
      message: isProd ? 'An unexpected error occurred' : error.message,
      ...(isProd ? {} : { stack: error.stack }),
    });
  });
});

export default errorHandlerPlugin;
export { errorHandlerPlugin };
