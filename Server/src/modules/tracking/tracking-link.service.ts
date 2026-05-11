import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackingTokenService } from './tracking-token.service';

interface LinkContext {
  campaignId: string;
  campaignRecipientId: string;
  contactId: string;
}

@Injectable()
export class TrackingLinkService {
  private readonly trackingBaseUrl: string;
  private readonly apiPrefix: string;

  constructor(
    private readonly tokenService: TrackingTokenService,
    private readonly configService: ConfigService,
  ) {
    this.trackingBaseUrl =
      this.configService.get<string>('tracking.baseUrl', { infer: true }) ??
      `http://localhost:${this.configService.get<number>('app.port', { infer: true }) ?? 5000}`;
    this.apiPrefix = this.configService.get<string>('app.apiPrefix', { infer: true }) ?? '';
  }

  generateOpenTrackingUrl(context: LinkContext): string {
    const token = this.tokenService.createOpenToken(context);
    return this.buildAbsolutePath(`/tracking/open/${encodeURIComponent(token)}`);
  }

  generateTrackedLink(destinationUrl: string, context: LinkContext): string {
    if (!this.isTrackableDestination(destinationUrl)) {
      return destinationUrl;
    }

    const token = this.tokenService.createClickToken({
      ...context,
      url: destinationUrl,
    });
    return this.buildAbsolutePath(`/tracking/click/${encodeURIComponent(token)}`);
  }

  applyTrackingToEmailContent(input: {
    html: string;
    text: string;
    trackOpens: boolean;
    trackClicks: boolean;
    campaignId: string;
    campaignRecipientId: string;
    contactId: string;
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
        this.generateTrackedLink(rawUrl.trim(), context),
      );
      text = text.replace(/{{TRACKED_LINK:([^}]+)}}/g, (_full, rawUrl: string) =>
        this.generateTrackedLink(rawUrl.trim(), context),
      );
    }

    let openPixelUrl: string | undefined;
    if (input.trackOpens) {
      openPixelUrl = this.generateOpenTrackingUrl(context);
      html = html.replace(/{{TRACKING_PIXEL_URL}}/g, openPixelUrl);
    }

    return {
      html,
      text,
      ...(openPixelUrl ? { openPixelUrl } : {}),
    };
  }

  private buildAbsolutePath(pathname: string): string {
    const cleanBase = this.trackingBaseUrl.replace(/\/+$/, '');
    const cleanPrefix = this.apiPrefix ? `/${this.apiPrefix.replace(/^\/+|\/+$/g, '')}` : '';
    const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

    return `${cleanBase}${cleanPrefix}${cleanPath}`;
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
