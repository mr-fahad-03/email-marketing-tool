import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    path: string;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const path = request.originalUrl ?? request.url ?? '';

    return next.handle().pipe(
      map((data) => {
        if (response.headersSent) {
          return data;
        }

        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>)
        ) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            path,
          },
        };
      }),
    );
  }
}
