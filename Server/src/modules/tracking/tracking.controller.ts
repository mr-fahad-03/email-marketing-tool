import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';

const TRANSPARENT_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64',
);

@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly trackingService: TrackingService) {}

  @Get('open/:token')
  async trackOpen(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    let result: { tracked: boolean; reason: string } = { tracked: false, reason: 'unknown' };
    try {
      result = await this.trackingService.handleOpenTracking({
        token,
        ip: this.resolveIp(request),
        userAgent: request.get('user-agent') ?? undefined,
        referrer: request.get('referer') ?? undefined,
      });
    } catch (error) {
      this.logger.warn(`Open tracking failed: ${(error as Error).message}`);
    }

    if (!result.tracked) {
      this.logger.warn(`Open tracking not recorded: reason=${result.reason}`);
    }

    response.setHeader('Content-Type', 'image/gif');
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.status(200).send(TRANSPARENT_PIXEL_GIF);
  }

  @Get('click/:token')
  async trackClick(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    let result: { redirectUrl: string | null; tracked: boolean; reason: string } = {
      redirectUrl: null,
      tracked: false,
      reason: 'unknown',
    };

    try {
      result = await this.trackingService.handleClickTracking({
        token,
        ip: this.resolveIp(request),
        userAgent: request.get('user-agent') ?? undefined,
        referrer: request.get('referer') ?? undefined,
      });
    } catch (error) {
      this.logger.warn(`Click tracking failed: ${(error as Error).message}`);
    }

    if (!result.tracked) {
      this.logger.warn(`Click tracking not recorded: reason=${result.reason}`);
    }

    if (!result.redirectUrl) {
      response.status(404).send('Tracking link not found');
      return;
    }

    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.redirect(302, result.redirectUrl);
  }

  private resolveIp(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0]?.trim() || undefined;
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length) {
      const first = forwardedFor[0];
      if (first) {
        return first.split(',')[0]?.trim() || undefined;
      }
    }

    return request.ip || undefined;
  }
}
