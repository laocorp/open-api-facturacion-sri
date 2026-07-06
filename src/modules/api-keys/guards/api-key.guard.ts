import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys.service';
import { RateLimitService } from '../services/rate-limit.service';
import { IS_API_KEY } from '../decorators/api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isApiKeyRoute = this.reflector.getAllAndOverride<boolean>(IS_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isApiKeyRoute) return true;

    const req = context.switchToHttp().getRequest();
    const rawKey = req.headers['x-api-key'] as string;

    if (!rawKey) {
      throw new UnauthorizedException('X-Api-Key header requerido');
    }

    const result = await this.apiKeysService.validate(rawKey);
    if (!result) {
      throw new UnauthorizedException('API Key inválida o inactiva');
    }

    const rateResult = await this.rateLimitService.check(result.tenantId, result.tier);

    req.tenant = { id: result.tenantId, tier: result.tier };

    const res = context.switchToHttp().getResponse();
    res.header('X-RateLimit-Limit', rateResult.allowed ? '1' : '0');
    res.header('X-RateLimit-Remaining', String(rateResult.remaining));
    res.header('X-RateLimit-Reset', String(rateResult.reset));

    if (!rateResult.allowed) {
      throw new HttpException('Rate limit excedido', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
