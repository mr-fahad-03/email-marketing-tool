import type { TemplateCategory, TemplateDesignJson, TemplateLayoutPreset } from '@/lib/types/template';
import { getLayoutPresetDefinition } from '@/lib/constants/template-layouts';

export interface TemplateLibraryItem {
  id: string;
  name: string;
  category: TemplateCategory;
  source?: 'local' | 'provider';
  provider?: 'mjml';
  providerTemplateId?: string;
  subject: string;
  body: string;
  summary?: string;
  previewImageUrl?: string;
  editorType: 'layout' | 'html';
  layoutPreset: TemplateLayoutPreset | null;
  designJson?: TemplateDesignJson | null;
}

function createLayoutItem(
  id: string,
  name: string,
  category: TemplateCategory,
  layoutPreset: TemplateLayoutPreset,
  overrides?: {
    subject?: string;
    body?: string;
  },
): TemplateLibraryItem {
  const definition = getLayoutPresetDefinition(layoutPreset);
  return {
    id,
    name,
    category,
    subject: overrides?.subject ?? definition.starterSubject,
    body: overrides?.body ?? definition.starterHtml,
    editorType: 'layout',
    layoutPreset,
  };
}

export const EMAIL_TEMPLATE_LIBRARY: TemplateLibraryItem[] = [
  createLayoutItem('lib-business-onboarding', 'Business Onboarding', 'business', 'basic', {
    subject: 'Welcome to {{company}}',
  }),
  createLayoutItem('lib-online-store-flash-sale', 'Online Store Flash Sale', 'online-store', 'commerce', {
    subject: '{{firstName}}, your cart favorites are on sale',
  }),
  createLayoutItem('lib-kitchen-menu-weekly', 'Kitchen Weekly Menu', 'kitchen', 'news', {
    subject: 'This week in the kitchen at {{company}}',
  }),
  createLayoutItem('lib-medicine-wellness-check', 'Medicine Wellness Check', 'medicine', 'text', {
    subject: 'Important wellness reminder for {{firstName}}',
  }),
  createLayoutItem('lib-education-course-update', 'Education Course Update', 'education', 'three-columns', {
    subject: 'New lessons now available in {{company}} Academy',
  }),
  createLayoutItem('lib-general-monthly-news', 'General Monthly News', 'general', 'news', {
    subject: '{{company}} monthly digest',
  }),
  createLayoutItem('lib-holidays-special-offer', 'Holidays Special Offer', 'holidays', 'commerce', {
    subject: 'Holiday season deals for {{firstName}}',
  }),
  createLayoutItem('lib-tourism-travel-guide', 'Tourism Travel Guide', 'tourism', 'three-columns', {
    subject: 'Travel highlights and destination picks',
  }),
  {
    id: 'lib-html-transactional',
    name: 'Transactional Receipt',
    category: 'general',
    subject: 'Your receipt from {{company}}',
    editorType: 'html',
    layoutPreset: null,
    body: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:24px;">
          <table width="620" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:8px;padding:24px;">
            <tr><td><h1 style="margin:0 0 12px;font-size:24px;">Payment received</h1></td></tr>
            <tr><td style="font-size:14px;line-height:1.6;">Hello {{firstName}}, thanks for your purchase. Order ID: <strong>{{order.id}}</strong>.</td></tr>
            <tr><td style="padding-top:18px;"><a href="https://example.com/orders/{{order.id}}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;">View order</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  },
];
