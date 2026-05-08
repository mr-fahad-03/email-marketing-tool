import { registerAs } from '@nestjs/config';

function resolveCorsOrigins(nodeEnv: string, rawOrigins: string): string[] {
  const configuredOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv !== 'production') {
    return Array.from(
      new Set(['http://localhost:3000', 'http://127.0.0.1:3000', ...configuredOrigins]),
    );
  }

  return configuredOrigins;
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  apiPrefix: process.env.API_PREFIX ?? '',
  corsOrigins: resolveCorsOrigins(
    process.env.NODE_ENV ?? 'development',
    process.env.CORS_ORIGINS ?? 'http://localhost:3000',
  ),
}));

export const mongoConfig = registerAs('mongo', () => ({
  uri: process.env.MONGODB_URI,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB ?? 0),
  connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10000),
  retryDelayMs: Number(process.env.REDIS_RETRY_DELAY_MS ?? 1000),
  retryMaxAttempts: Number(process.env.REDIS_RETRY_MAX_ATTEMPTS ?? 5),
  family: Number(process.env.REDIS_FAMILY ?? 0),
  keyPrefix: process.env.BULLMQ_PREFIX ?? 'marketing-platform',
  skipVersionCheck: (process.env.BULLMQ_SKIP_VERSION_CHECK ?? 'false') === 'true',
  skipWaitingForReady: (process.env.BULLMQ_SKIP_WAITING_FOR_READY ?? 'true') === 'true',
}));

export const queueConfig = registerAs('queues', () => ({
  workersEnabled: (process.env.QUEUE_WORKERS_ENABLED ?? 'false') === 'true',
  defaultAttempts: Number(process.env.QUEUE_DEFAULT_ATTEMPTS ?? 5),
  defaultBackoffMs: Number(process.env.QUEUE_DEFAULT_BACKOFF_MS ?? 5000),
  concurrency: {
    contactImport: Number(process.env.CONTACT_IMPORT_CONCURRENCY ?? 2),
    campaignScheduler: Number(process.env.CAMPAIGN_SCHEDULER_CONCURRENCY ?? 2),
    emailSend: Number(process.env.EMAIL_SEND_CONCURRENCY ?? 5),
    whatsappSend: Number(process.env.WHATSAPP_SEND_CONCURRENCY ?? 5),
    webhookProcessing: Number(process.env.WEBHOOK_PROCESSING_CONCURRENCY ?? 5),
    analyticsAggregation: Number(process.env.ANALYTICS_AGGREGATION_CONCURRENCY ?? 2),
  },
}));

export const trackingConfig = registerAs('tracking', () => ({
  baseUrl: process.env.TRACKING_BASE_URL ?? '',
  tokenTtlSeconds: Number(process.env.TRACKING_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30),
}));

export const webhookConfig = registerAs('webhooks', () => ({
  whatsappVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '',
}));

export const securityConfig = registerAs('security', () => ({
  senderSecretsKey: process.env.SENDER_SECRETS_KEY,
  trackingTokenSecret: process.env.TRACKING_TOKEN_SECRET,
}));

export const templateProvidersConfig = registerAs('templateProviders', () => ({
  mjml: {
    enabled: (process.env.MJML_PROVIDER_ENABLED ?? 'true') === 'true',
    apiBaseUrl: process.env.MJML_API_BASE_URL ?? 'https://api.mjml.io/v1',
    appId: process.env.MJML_API_APP_ID ?? '',
    secretKey: process.env.MJML_API_SECRET_KEY ?? '',
    renderMode: process.env.MJML_RENDER_MODE ?? 'hybrid',
    repoOwner: process.env.MJML_TEMPLATE_REPO_OWNER ?? 'mjmlio',
    repoName: process.env.MJML_TEMPLATE_REPO_NAME ?? 'email-templates',
    repoBranch: process.env.MJML_TEMPLATE_REPO_BRANCH ?? 'master',
    githubToken: process.env.GITHUB_TOKEN ?? '',
  },
}));

export const mediaConfig = registerAs('media', () => ({
  templateImages: {
    uploadDir: process.env.TEMPLATE_IMAGES_UPLOAD_DIR ?? 'uploads/template-images',
    publicPath: process.env.TEMPLATE_IMAGES_PUBLIC_PATH ?? '/uploads/template-images',
    publicBaseUrl: process.env.TEMPLATE_IMAGES_PUBLIC_BASE_URL ?? '',
    quotaMb: Number(process.env.TEMPLATE_IMAGES_QUOTA_MB ?? 250),
    maxFileSizeMb: Number(process.env.TEMPLATE_IMAGES_MAX_FILE_SIZE_MB ?? 10),
  },
}));

export const configuration = [
  appConfig,
  mongoConfig,
  jwtConfig,
  redisConfig,
  queueConfig,
  trackingConfig,
  webhookConfig,
  securityConfig,
  templateProvidersConfig,
  mediaConfig,
];
