import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
const logger = new Logger('RedisProvider');

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    const client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD', '') || undefined,
      db: 2,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    client.on('connect', async () => {
      try {
        const policy = (await client.config('GET', 'maxmemory-policy')) as [string, string];
        if (policy[1] !== 'noeviction') {
          logger.warn(`Redis maxmemory-policy is "${policy[1]}". Rate limiting keys may be evicted. Set to "noeviction" in Dokploy Redis config.`);
        }
      } catch {
        logger.warn('Could not check Redis maxmemory-policy. Ensure it is set to "noeviction".');
      }
    });

    return client;
  },
  inject: [ConfigService],
};
