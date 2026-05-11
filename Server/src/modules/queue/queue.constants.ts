import { JobsOptions } from 'bullmq';

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const toPositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
};

export const QUEUE_NAMES = {
  CONTACT_IMPORT: 'contact-import',
  CAMPAIGN_SCHEDULER: 'campaign-scheduler',
  EMAIL_SEND: 'email-send',
  WHATSAPP_SEND: 'whatsapp-send',
  WEBHOOK_PROCESSING: 'webhook-processing',
  ANALYTICS_AGGREGATION: 'analytics-aggregation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export const REGISTERED_QUEUES = Object.values(QUEUE_NAMES);

export const QUEUE_WORKERS_ENABLED = toBoolean(
  process.env.QUEUE_WORKERS_ENABLED,
  true,
);

export const QUEUE_WORKER_SKIP_VERSION_CHECK = toBoolean(
  process.env.BULLMQ_SKIP_VERSION_CHECK,
  false,
);

export const QUEUE_WORKER_SKIP_WAITING_FOR_READY = toBoolean(
  process.env.BULLMQ_SKIP_WAITING_FOR_READY,
  true,
);

export const QUEUE_CONCURRENCY = {
  [QUEUE_NAMES.CONTACT_IMPORT]: toPositiveInt(process.env.CONTACT_IMPORT_CONCURRENCY, 2),
  [QUEUE_NAMES.CAMPAIGN_SCHEDULER]: toPositiveInt(process.env.CAMPAIGN_SCHEDULER_CONCURRENCY, 2),
  [QUEUE_NAMES.EMAIL_SEND]: toPositiveInt(process.env.EMAIL_SEND_CONCURRENCY, 5),
  [QUEUE_NAMES.WHATSAPP_SEND]: toPositiveInt(process.env.WHATSAPP_SEND_CONCURRENCY, 5),
  [QUEUE_NAMES.WEBHOOK_PROCESSING]: toPositiveInt(process.env.WEBHOOK_PROCESSING_CONCURRENCY, 5),
  [QUEUE_NAMES.ANALYTICS_AGGREGATION]: toPositiveInt(
    process.env.ANALYTICS_AGGREGATION_CONCURRENCY,
    2,
  ),
} as const;

export const QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: toPositiveInt(process.env.QUEUE_DEFAULT_ATTEMPTS, 5),
  backoff: {
    type: 'exponential',
    delay: toPositiveNumber(process.env.QUEUE_DEFAULT_BACKOFF_MS, 5000),
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
