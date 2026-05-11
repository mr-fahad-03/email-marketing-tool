export interface RenderedEmailContent {
  subject: string;
  html: string;
  text: string;
  unresolvedVariables: string[];
}

const VARIABLE_REGEX = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export const renderEmailTemplateWithContact = (
  subjectTemplate: string,
  htmlTemplate: string,
  textTemplate: string,
  context: Record<string, unknown>,
): RenderedEmailContent => {
  const subject = renderText(subjectTemplate, context);
  const html = renderText(htmlTemplate, context);
  const text = renderText(textTemplate, context);

  const unresolvedVariables = Array.from(
    new Set([
      ...subject.unresolvedVariables,
      ...html.unresolvedVariables,
      ...text.unresolvedVariables,
    ]),
  );

  return {
    subject: subject.rendered,
    html: html.rendered,
    text: text.rendered,
    unresolvedVariables,
  };
};

export const injectEmailTrackingPlaceholders = (input: {
  html: string;
  text: string;
  trackOpens: boolean;
  trackClicks: boolean;
}): { html: string; text: string } => {
  let html = input.html;
  let text = input.text;

  if (input.trackClicks) {
    html = html.replace(
      /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
      (full, doubleQuoted: string, singleQuoted: string, unquoted: string) => {
        const url = (doubleQuoted ?? singleQuoted ?? unquoted ?? '').trim();
        if (!url || url.startsWith('{{TRACKED_LINK:')) {
          return full;
        }

        if (url.startsWith('#') || url.startsWith('mailto:')) {
          return full;
        }

        return `href="{{TRACKED_LINK:${url}}}"`;
      },
    );

    text = text.replace(
      /\bhttps?:\/\/[^\s<>"')\]]+/gi,
      (url) => `{{TRACKED_LINK:${url}}}`,
    );
  }

  if (input.trackOpens) {
    const trackingPixel =
      '<img src="{{TRACKING_PIXEL_URL}}" alt="" width="1" height="1" style="width:1px;height:1px;opacity:0;border:0;" />';
    const bodyCloseTagPattern = /<\/body\s*>/i;
    if (bodyCloseTagPattern.test(html)) {
      html = html.replace(bodyCloseTagPattern, `${trackingPixel}</body>`);
    } else {
      const htmlCloseTagPattern = /<\/html\s*>/i;
      if (htmlCloseTagPattern.test(html)) {
        html = html.replace(htmlCloseTagPattern, `${trackingPixel}</html>`);
      } else {
        html = `${html}\n${trackingPixel}`.trim();
      }
    }
  }

  return { html, text };
};

const renderText = (
  template: string,
  context: Record<string, unknown>,
): { rendered: string; unresolvedVariables: string[] } => {
  const unresolved = new Set<string>();
  const rendered = template.replace(VARIABLE_REGEX, (full, tokenRaw: string) => {
    const token = tokenRaw.trim();
    const value = resolvePath(context, token);

    if (value === undefined || value === null) {
      unresolved.add(token);
      return full;
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });

  return {
    rendered,
    unresolvedVariables: Array.from(unresolved),
  };
};

const resolvePath = (context: Record<string, unknown>, token: string): unknown => {
  const segments = token.split('.');
  let current: unknown = context;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};
