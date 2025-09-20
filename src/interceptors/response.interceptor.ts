import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const statusCode = response.statusCode;

        if (data && typeof data === 'object' && 'data' in data) {
          return {
            success: statusCode < 400,
            ...data,
            message: response.statusMessage || 'OK',
          };
        }
        return {
          success: response.statusCode < 400,
          data,
          message: response.statusMessage || 'OK',
        };
      }),
    );
  }
}
