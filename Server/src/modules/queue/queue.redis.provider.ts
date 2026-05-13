import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const BULLMQ_SHARED_CONNECTION = Symbol('BULLMQ_SHARED_CONNECTION');

@Injectable()
export class QueueRedisConnectionProvider implements OnApplicationShutdown {
  private readonly logger = new Logger(QueueRedisConnectionProvider.name);

  private hasLoggedClientLimitError = false;
  private hasLoggedDnsResolutionError = false;
  private hasLoggedRetryLimitError = false;

  readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const connectTimeoutMs =
      this.configService.get<number>('redis.connectTimeoutMs', { infer: true }) ?? 10000;
    const retryDelayMs =
      this.configService.get<number>('redis.retryDelayMs', { infer: true }) ?? 1000;
    const retryMaxAttempts =
      this.configService.get<number>('redis.retryMaxAttempts', { infer: true }) ?? 5;
    const family = this.configService.get<number>('redis.family', { infer: true }) ?? 0;

    this.client = new Redis({
      host: this.configService.get<string>('redis.host', { infer: true }),
      port: this.configService.get<number>('redis.port', { infer: true }),
      password: this.configService.get<string>('redis.password', { infer: true }),
      db: this.configService.get<number>('redis.db', { infer: true }),
      family,
      connectionName: 'bullmq:shared',
      lazyConnect: true,
      connectTimeout: connectTimeoutMs,
      maxRetriesPerRequest: null,
      retryStrategy: (attempt): number | null => {
        if (attempt > retryMaxAttempts) {
          if (!this.hasLoggedRetryLimitError) {
            this.hasLoggedRetryLimitError = true;
            this.logger.error(
              `Redis reconnect retry limit reached (${retryMaxAttempts}). Stopping retries for this client.`,
            );
          }
          return null;
        }

        return retryDelayMs;
      },
    });

    this.client.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'ENOTFOUND') {
        if (!this.hasLoggedDnsResolutionError) {
          this.hasLoggedDnsResolutionError = true;
          const host =
            this.configService.get<string>('redis.host', { infer: true }) ?? 'unknown host';
          this.logger.error(
            `Redis hostname could not be resolved (${host}). Check REDIS_HOST / DNS configuration.`,
          );
        }
        return;
      }

      if (error.message.includes('max number of clients reached')) {
        if (!this.hasLoggedClientLimitError) {
          this.hasLoggedClientLimitError = true;
          this.logger.error(
            'Redis rejected connections due to max clients limit. Disable embedded workers or increase Redis max clients.',
          );
        }
        return;
      }

      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

export const bullmqSharedConnectionProvider = {
  provide: BULLMQ_SHARED_CONNECTION,
  useFactory: (provider: QueueRedisConnectionProvider): Redis => provider.client,
  inject: [QueueRedisConnectionProvider],
};
