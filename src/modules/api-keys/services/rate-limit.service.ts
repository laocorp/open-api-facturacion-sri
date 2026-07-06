import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../../../common/redis/redis.provider';
import type Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

const TIER_LIMITS: Record<string, { limit: number; window: number }> = {
  basic: { limit: 30, window: 60 },
  professional: { limit: 120, window: 60 },
  enterprise: { limit: 600, window: 60 },
  unlimited: { limit: 0, window: 1 },
};

@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly prefix = 'ratelimit';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.redis.connect();
    } catch {
      // already connected or will connect on first use
    }
  }

  async check(key: string, tier: string): Promise<RateLimitResult> {
    const cfg = TIER_LIMITS[tier] || TIER_LIMITS.basic;
    if (cfg.limit === 0) {
      return { allowed: true, remaining: 999999, reset: 60 };
    }

    const now = Date.now();
    const window = cfg.window * 1000;
    const redisKey = `${this.prefix}:${tier}:${key}`;

    const result = await this.multiExec(redisKey, now, window, cfg.limit);
    return result;
  }

  private async multiExec(
    redisKey: string,
    now: number,
    window: number,
    limit: number,
  ): Promise<RateLimitResult> {
    const multi = this.redis.multi();
    const minScore = now - window;
    const member = `${now}:${Math.random().toString(36).substring(2, 8)}`;

    multi.zremrangebyscore(redisKey, 0, minScore);
    multi.zadd(redisKey, now, member);
    multi.zcard(redisKey);
    multi.expire(redisKey, Math.ceil(window / 1000) + 1);
    multi.zrangebyscore(redisKey, minScore, '+inf');

    const results = await multi.exec();
    if (!results) {
      return { allowed: true, remaining: limit, reset: Math.ceil(window / 1000) };
    }

    const count = results[2]?.[1] as number || 0;
    const scores = results[4]?.[1] as string[] || [];
    const oldest = scores.length > 0 ? parseFloat(scores[0]) : now;
    const reset = Math.max(1, Math.ceil((oldest + window - now) / 1000));

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      reset,
    };
  }
}
