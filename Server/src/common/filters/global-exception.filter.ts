import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseShape {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    path: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ originalUrl?: string; url?: string }>();

    if (response.headersSent) {
      return;
    }

    const path = request.originalUrl ?? request.url ?? '';
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const responseObject = exceptionResponse as {
          message?: string | string[];
          error?: string;
          code?: string;
          details?: unknown;
        };

        if (Array.isArray(responseObject.message)) {
          message = responseObject.message.join(', ');
          details = responseObject.message;
        } else if (responseObject.message) {
          message = responseObject.message;
        } else {
          message = exception.message;
        }

        code = responseObject.code ?? responseObject.error ?? this.mapStatusToCode(status);
        if (responseObject.details !== undefined) {
          details = responseObject.details;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      meta: {
        timestamp,
        path,
      },
    });
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'HTTP_EXCEPTION';
    }
  }
}
