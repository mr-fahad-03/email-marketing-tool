import { z } from 'zod';

export const templateFormSchema = z.object({
  type: z.enum(['email', 'whatsapp']),
  editorType: z.enum(['layout', 'html']).default('html'),
  category: z
    .enum([
      'business',
      'ecommerce',
      'restaurant',
      'other',
      'holiday',
      'travel',
      'online-store',
      'kitchen',
      'medicine',
      'education',
      'general',
      'holidays',
      'tourism',
      'marketing',
      'transactional',
      'utility',
      'authentication',
    ])
    .default('general'),
  layoutPreset: z
    .enum(['empty', 'basic', 'commerce', 'three-columns', 'news', 'text'])
    .nullable()
    .optional(),
  designJson: z.record(z.string(), z.unknown()).nullable().optional(),
  mjmlBody: z.string().nullable().optional(),
  name: z.string().min(2, 'Template name must be at least 2 characters.'),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Body is required.'),
  status: z.string().optional(),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

