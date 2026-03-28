import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const BULLMQ_SHARED_CONNECTION = Symbol('BULLMQ_SHARED_CONNECTION');

@Injectable()
export class QueueRedisConnectionProvider implements OnApplicationShutdown {
  readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host', { infer: true }),
      port: this.configService.get<number>('redis.port', { infer: true }),
      password: this.configService.get<string>('redis.password', { infer: true }),
      db: this.configService.get<number>('redis.db', { infer: true }),
      connectionName: 'bullmq:shared',
      lazyConnect: true,
      maxRetriesPerRequest: null,
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
