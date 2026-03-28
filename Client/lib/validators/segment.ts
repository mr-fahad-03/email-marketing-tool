import { z } from 'zod';

export const segmentFormSchema = z.object({
  name: z.string().min(2, 'Segment name must be at least 2 characters.'),
  description: z.string().optional(),
  type: z.enum(['static', 'dynamic']).default('static'),
  audienceMode: z.enum(['filters', 'contacts']).default('filters'),
  filterTags: z.array(z.string()).default([]),
  filterStatus: z.array(z.string()).default([]),
  contactIds: z.array(z.string()).default([]),
}).superRefine((values, ctx) => {
  if (values.type === 'static' && values.audienceMode === 'contacts' && values.contactIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactIds'],
      message: 'Select at least one contact.',
    });
  }
});

export type SegmentFormValues = z.infer<typeof segmentFormSchema>;
