import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(5000),
  API_PREFIX: Joi.string().allow('').default(''),
  REQUEST_BODY_LIMIT: Joi.string().default('50mb'),
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
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  REDIS_RETRY_DELAY_MS: Joi.number().integer().min(100).default(1000),
  REDIS_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(0).default(5),
  REDIS_FAMILY: Joi.number().valid(0, 4, 6).default(0),
  BULLMQ_PREFIX: Joi.string().default('marketing-platform'),
  BULLMQ_SKIP_VERSION_CHECK: Joi.boolean().truthy('true').falsy('false').default(false),
  BULLMQ_SKIP_WAITING_FOR_READY: Joi.boolean().truthy('true').falsy('false').default(true),
  QUEUE_WORKERS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
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
  MJML_PROVIDER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  MJML_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://api.mjml.io/v1'),
  MJML_API_APP_ID: Joi.string().allow('').optional(),
  MJML_API_SECRET_KEY: Joi.string().allow('').optional(),
  MJML_RENDER_MODE: Joi.string().valid('hybrid', 'api_only', 'local_only').default('hybrid'),
  MJML_TEMPLATE_REPO_OWNER: Joi.string().default('Easy-Email-Pro'),
  MJML_TEMPLATE_REPO_NAME: Joi.string().default('email-templates'),
  MJML_TEMPLATE_REPO_BRANCH: Joi.string().default('main'),
  GITHUB_TOKEN: Joi.string().allow('').optional(),
  TEMPLATE_LIBRARY_DIR: Joi.string().default('assets/email-template-library/easy-email'),
  TEMPLATE_LIBRARY_PUBLIC_PATH: Joi.string().default('/template-library/easy-email'),
  TEMPLATE_IMAGES_UPLOAD_DIR: Joi.string().default('uploads/template-images'),
  TEMPLATE_IMAGES_PUBLIC_PATH: Joi.string().default('/uploads/template-images'),
  TEMPLATE_IMAGES_PUBLIC_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),
  TEMPLATE_IMAGES_QUOTA_MB: Joi.number().min(1).default(250),
  TEMPLATE_IMAGES_MAX_FILE_SIZE_MB: Joi.number().min(1).default(10),
});
