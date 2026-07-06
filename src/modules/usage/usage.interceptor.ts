import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { UsageService } from './usage.service';

@Injectable()
export class UsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageInterceptor.name);

  constructor(private readonly usageService: UsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url || '';

    return next.handle().pipe(
      tap(() => {
        const tenant = (req as any).tenant?.id || (req as any).user?.tenantId;
        if (!tenant) return;

        this.usageService.log({
          tenantId: tenant,
          apiKeyId: (req as any).apiKey?.id,
          endpoint: url,
          method,
          comprobanteType: this.extractType(url),
          claveAcceso: req.params?.['claveAcceso'] as string,
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - start,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }),
      catchError((err) => {
        const tenant = (req as any).tenant?.id || (req as any).user?.tenantId;
        if (tenant) {
          this.usageService.log({
            tenantId: tenant,
            endpoint: url,
            method,
            statusCode: err?.status || 500,
            responseTimeMs: Date.now() - start,
          });
        }
        return throwError(() => err);
      }),
    );
  }

  private extractType(url: string): string | undefined {
    if (url.includes('factura')) return 'factura';
    if (url.includes('nota-credito')) return 'nota_credito';
    if (url.includes('nota-debito')) return 'nota_debito';
    if (url.includes('retencion')) return 'retencion';
    if (url.includes('guia-remision')) return 'guia_remision';
    return undefined;
  }
}
