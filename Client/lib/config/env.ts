import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_TEMPLATE_VISUAL_EDITOR: z.enum(['grapesjs', 'unlayer']).optional(),
  NEXT_PUBLIC_UNLAYER_PROJECT_ID: z
    .string()
    .regex(/^\d+$/)
    .optional(),
});

const parsed = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_TEMPLATE_VISUAL_EDITOR: process.env.NEXT_PUBLIC_TEMPLATE_VISUAL_EDITOR,
  NEXT_PUBLIC_UNLAYER_PROJECT_ID: process.env.NEXT_PUBLIC_UNLAYER_PROJECT_ID,
});

const fallbackApiUrl = 'http://localhost:5000';

export const env = {
  apiUrl: (parsed.NEXT_PUBLIC_API_URL ?? fallbackApiUrl).replace(/\/+$/, ''),
  templateVisualEditor: parsed.NEXT_PUBLIC_TEMPLATE_VISUAL_EDITOR ?? 'grapesjs',
  unlayerProjectId: parsed.NEXT_PUBLIC_UNLAYER_PROJECT_ID
    ? Number(parsed.NEXT_PUBLIC_UNLAYER_PROJECT_ID)
    : undefined,
} as const;
