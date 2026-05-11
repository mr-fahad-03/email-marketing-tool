import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppException } from '../../../common/exceptions/app.exception';
import { EmailSendWorkerInput, EmailService } from '../../email/email.service';
import {
  QUEUE_CONCURRENCY,
  QUEUE_NAMES,
  QUEUE_WORKER_SKIP_VERSION_CHECK,
  QUEUE_WORKER_SKIP_WAITING_FOR_READY,
} from '../queue.constants';

@Injectable()
@Processor(QUEUE_NAMES.EMAIL_SEND, {
  concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.EMAIL_SEND],
  skipVersionCheck: QUEUE_WORKER_SKIP_VERSION_CHECK,
  skipWaitingForReady: QUEUE_WORKER_SKIP_WAITING_FOR_READY,
})
export class EmailSendProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailSendProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailSendWorkerInput>): Promise<void> {
    try {
      const payload = job.data;

      if (
        !payload?.campaignId ||
        !payload?.campaignRecipientId ||
        !payload?.senderAccountId ||
        !payload?.contactId
      ) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'INVALID_EMAIL_SEND_JOB',
          'campaignId, campaignRecipientId, senderAccountId, and contactId are required',
        );
      }

      const outcome = await this.emailService.processSendJob(payload, {
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1,
      });

      if (outcome.type === 'retryable_failure') {
        throw new AppException(
          HttpStatus.SERVICE_UNAVAILABLE,
          'EMAIL_SEND_RETRYABLE_FAILURE',
          outcome.message,
        );
      }

      if (outcome.type === 'permanent_failure') {
        this.logger.warn(
          `Permanent email failure for campaignRecipient=${payload.campaignRecipientId}: ${outcome.message}`,
        );
      }
    } catch (error) {
      if (error instanceof AppException) {
        const response = error.getResponse() as { code?: string; message?: string };
        if (response.code === 'EMAIL_SEND_RETRYABLE_FAILURE') {
          throw error;
        }

        await this.emailService.markJobAsFailedForNonRetryableError(
          job.data,
          `${response.code ?? 'APP_EXCEPTION'}: ${response.message ?? error.message}`,
        );

        this.logger.warn(
          `Non-retryable email send job failure id=${job.id}: ${response.code ?? 'APP_EXCEPTION'} ${response.message ?? error.message}`,
        );
        return;
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailSendWorkerInput>, error: Error): void {
    this.logger.error(
      `Email send job failed id=${job.id} name=${job.name}: ${error.message}`,
      error.stack,
    );
  }
}
