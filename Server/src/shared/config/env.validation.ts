import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().allow('').default(''),
  CORS_ORIGINS: Joi.string().allow('').default('http://localhost:3000'),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().min(0).default(0),
  BULLMQ_PREFIX: Joi.string().default('marketing-platform'),
  BULLMQ_SKIP_VERSION_CHECK: Joi.boolean().truthy('true').falsy('false').default(false),
  QUEUE_DEFAULT_ATTEMPTS: Joi.number().integer().min(1).default(5),
  QUEUE_DEFAULT_BACKOFF_MS: Joi.number().integer().min(1).default(5000),
  CONTACT_IMPORT_CONCURRENCY: Joi.number().integer().min(1).default(2),
  CAMPAIGN_SCHEDULER_CONCURRENCY: Joi.number().integer().min(1).default(2),
  EMAIL_SEND_CONCURRENCY: Joi.number().integer().min(1).default(5),
  WHATSAPP_SEND_CONCURRENCY: Joi.number().integer().min(1).default(5),
  WEBHOOK_PROCESSING_CONCURRENCY: Joi.number().integer().min(1).default(5),
  ANALYTICS_AGGREGATION_CONCURRENCY: Joi.number().integer().min(1).default(2),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string().allow('').default(''),
  TRACKING_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:5000'),
  TRACKING_TOKEN_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .default(60 * 60 * 24 * 30),
  TRACKING_TOKEN_SECRET: Joi.string().min(32).required(),
  SENDER_SECRETS_KEY: Joi.string().min(32).required(),
});
