import { Module } from '@nestjs/common';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { EmailModule } from './modules/email/email.module';
import { HistoryModule } from './modules/history/history.module';
import { ImportsModule } from './modules/imports/imports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueueModule } from './modules/queue/queue.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { SenderAccountsModule } from './modules/sender-accounts/sender-accounts.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SuppressionModule } from './modules/suppression/suppression.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { TemplateImagesModule } from './modules/template-images/template-images.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { DatabaseModule } from './shared/database/database.module';
import { SharedConfigModule } from './shared/config/shared-config.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    QueueModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    SenderAccountsModule,
    SettingsModule,
    ContactsModule,
    SegmentsModule,
    TemplatesModule,
    TemplateImagesModule,
    CampaignsModule,
    EmailModule,
    WhatsappModule,
    TrackingModule,
    SuppressionModule,
    ImportsModule,
    WebhooksModule,
    AnalyticsModule,
    HistoryModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
