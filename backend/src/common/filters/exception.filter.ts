import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as any).message
          : exception.message;
      return res.status(status).json({ detail: Array.isArray(detail) ? detail.join('; ') : detail });
    }

    if (exception instanceof UnauthorizedException) {
      return res.status(401).json({ detail: 'Unauthorized' });
    }
    if (exception instanceof ForbiddenException) {
      return res.status(403).json({ detail: 'Forbidden' });
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: 'An unexpected error occurred' });
  }
}
