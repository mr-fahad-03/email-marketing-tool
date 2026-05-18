import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackingTokenService } from './tracking-token.service';

interface LinkContext {
  campaignId: string;
  campaignRecipientId: string;
  contactId: string;
}

@Injectable()
export class TrackingLinkService {
  private readonly logger = new Logger(TrackingLinkService.name);
  private readonly trackingBaseUrl: string;
  private readonly apiPrefix: string;

  constructor(
    private readonly tokenService: TrackingTokenService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl =
      this.configService.get<string>('tracking.baseUrl', { infer: true })?.trim() ||
      this.configService.get<string>('TRACKING_BASE_URL')?.trim();
    const fallbackBaseUrl = `http://localhost:${
      this.configService.get<number>('app.port', { infer: true }) ?? 5000
    }`;

    this.trackingBaseUrl = this.normalizeBaseUrl(configuredBaseUrl || fallbackBaseUrl);
    this.apiPrefix = this.normalizeApiPrefix(
      this.configService.get<string>('app.apiPrefix', { infer: true }) ?? '',
    );
    this.warnIfDevelopmentTrackingPointsRemote(configuredBaseUrl);
  }

  generateOpenTrackingUrl(context: LinkContext, overrideBaseUrl?: string | null): string {
    const token = this.tokenService.createOpenToken(context);
    return this.buildAbsolutePath(`/tracking/open/${encodeURIComponent(token)}`, overrideBaseUrl);
  }

  generateTrackedLink(
    destinationUrl: string,
    context: LinkContext,
    overrideBaseUrl?: string | null,
  ): string {
    if (!this.isTrackableDestination(destinationUrl)) {
      return destinationUrl;
    }

    const token = this.tokenService.createClickToken({
      ...context,
      url: destinationUrl,
    });
    return this.buildAbsolutePath(`/tracking/click/${encodeURIComponent(token)}`, overrideBaseUrl);
  }

  applyTrackingToEmailContent(input: {
    html: string;
    text: string;
    trackOpens: boolean;
    trackClicks: boolean;
    campaignId: string;
    campaignRecipientId: string;
    contactId: string;
    trackingBaseUrl?: string | null;
  }): { html: string; text: string; openPixelUrl?: string } {
    const context: LinkContext = {
      campaignId: input.campaignId,
      campaignRecipientId: input.campaignRecipientId,
      contactId: input.contactId,
    };

    let html = input.html;
    let text = input.text;

    if (input.trackClicks) {
      html = html.replace(/{{TRACKED_LINK:([^}]+)}}/g, (_full, rawUrl: string) =>
        this.generateTrackedLink(rawUrl.trim(), context, input.trackingBaseUrl),
      );
      text = text.replace(/{{TRACKED_LINK:([^}]+)}}/g, (_full, rawUrl: string) =>
        this.generateTrackedLink(rawUrl.trim(), context, input.trackingBaseUrl),
      );
    }

    let openPixelUrl: string | undefined;
    if (input.trackOpens) {
      openPixelUrl = this.generateOpenTrackingUrl(context, input.trackingBaseUrl);
      html = html.replace(/{{TRACKING_PIXEL_URL}}/g, openPixelUrl);
    }

    return {
      html,
      text,
      ...(openPixelUrl ? { openPixelUrl } : {}),
    };
  }

  private buildAbsolutePath(pathname: string, overrideBaseUrl?: string | null): string {
    const baseToUse = overrideBaseUrl
      ? this.normalizeBaseUrl(overrideBaseUrl)
      : this.trackingBaseUrl;
    const cleanBase = baseToUse.replace(/\/+$/, '');
    const cleanPrefix = this.resolveApiPrefixForBaseUrl(cleanBase);
    const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

    return `${cleanBase}${cleanPrefix}${cleanPath}`;
  }

  private normalizeBaseUrl(value: string): string {
    try {
      const url = new URL(value);
      url.hash = '';
      url.search = '';
      url.pathname = url.pathname.replace(/\/+$/, '');
      return url.toString().replace(/\/+$/, '');
    } catch {
      throw new Error(`Invalid TRACKING_BASE_URL: ${value}`);
    }
  }

  private normalizeApiPrefix(value: string): string {
    return value.trim().replace(/^\/+|\/+$/g, '');
  }

  private warnIfDevelopmentTrackingPointsRemote(configuredBaseUrl?: string): void {
    const nodeEnv = (this.configService.get<string>('app.nodeEnv', { infer: true }) ??
      process.env.NODE_ENV ??
      'development')
      .trim()
      .toLowerCase();

    if (nodeEnv === 'production' || nodeEnv === 'staging' || !configuredBaseUrl) {
      return;
    }

    try {
      const trackingUrl = new URL(this.trackingBaseUrl);
      if (this.isLocalHostname(trackingUrl.hostname)) {
        return;
      }

      this.logger.warn(
        `TRACKING_BASE_URL is set to a non-local host (${trackingUrl.origin}) while NODE_ENV=${nodeEnv}. Local open/click analytics will only appear in the backend served at that host.`,
      );
    } catch {
      // URL validity is enforced earlier. Ignore secondary parse errors.
    }
  }

  private isLocalHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
      normalized === 'localhost' ||
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local')
    );
  }

  private resolveApiPrefixForBaseUrl(baseUrl: string): string {
    if (!this.apiPrefix) {
      return '';
    }

    try {
      const url = new URL(baseUrl);
      const basePath = url.pathname.replace(/\/+$/, '');
      if (basePath === `/${this.apiPrefix}` || basePath.endsWith(`/${this.apiPrefix}`)) {
        return '';
      }
    } catch {
      return `/${this.apiPrefix}`;
    }

    return `/${this.apiPrefix}`;
  }

  private isTrackableDestination(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
