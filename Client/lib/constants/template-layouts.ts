import type { TemplateLayoutPreset } from '@/lib/types/template';

export interface LayoutPresetDefinition {
  id: TemplateLayoutPreset;
  label: string;
  description: string;
  starterSubject: string;
  starterMjml: string;
  starterHtml: string;
}

const BASE_STYLES = `
  body { margin:0; padding:0; background:#f4f8fb; font-family:"Segoe UI", Arial, Helvetica, sans-serif; color:#1f2937; }
  .container { max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #d7e3ec; border-radius:12px; overflow:hidden; }
  .hero { padding:26px 28px 18px; background:#e9f3fb; border-bottom:1px solid #d7e3ec; }
  .content { padding:24px 28px; }
  .section { margin-bottom:18px; }
  h1 { margin:0 0 10px; font-size:28px; line-height:1.2; letter-spacing:-0.02em; font-weight:700; color:#0f172a; }
  h2 { margin:0 0 8px; font-size:20px; line-height:1.3; letter-spacing:-0.01em; font-weight:650; color:#111827; }
  h3 { margin:0 0 6px; font-size:16px; line-height:1.35; font-weight:650; color:#1f2937; }
  p { margin:0 0 12px; line-height:1.65; font-size:14px; color:#334155; }
  .lead { font-size:15px; color:#1e293b; }
  .muted { color:#64748b; font-size:12px; }
  .btn { display:inline-block; padding:11px 18px; background:#14b8a6; color:#ffffff !important; text-decoration:none; border-radius:8px; font-weight:700; font-size:14px; }
  .card { border:1px solid #d7e3ec; border-radius:10px; padding:14px; background:#ffffff; margin-bottom:10px; }
  .cols-3 > div { width:31.33%; display:inline-block; vertical-align:top; margin:0 2% 12px 0; }
  .cols-3 > div:nth-child(3n) { margin-right:0; }
  .cols-3 > div:nth-last-child(-n+3) { margin-bottom:0; }
  .divider { height:1px; background:#e2e8f0; margin:16px 0; }
`;

function buildTemplate(body: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${BASE_STYLES}</style>
  </head>
  <body>
    <div class="container">
      ${body}
    </div>
  </body>
</html>`;
}

const BASIC_MJML = `<mjml>
  <mj-body background-color="#f4f8fb">
    <mj-section background-color="#e9f3fb" padding="26px 28px 18px">
      <mj-column>
        <mj-text font-size="28px" line-height="1.2" font-weight="700" color="#0f172a" padding="0 0 10px">
          Welcome, {{firstName}}
        </mj-text>
        <mj-text font-size="15px" color="#1e293b" padding="0">
          We are happy to have you at {{company}}.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="20px 28px 12px">
      <mj-column>
        <mj-image src="https://dummyimage.com/560x140/d9e8f4/7f9db1&text=Welcome+Banner" alt="Welcome banner" padding="0 0 14px" />
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="0 28px 24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="650" color="#111827" padding="0 0 8px">
          Your account is ready
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 6px">
          Everything is prepared for you.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 6px">
          Open your dashboard and review your setup.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          Start your first campaign in a few steps.
        </mj-text>
        <mj-button background-color="#14b8a6" color="#ffffff" border-radius="8px" href="https://example.com" inner-padding="9px 14px" width="140px" align="left">
          Go to Dashboard
        </mj-button>
        <mj-text font-size="12px" color="#64748b" padding="12px 0 0">
          Need help? Reply to this email and our team will assist you.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const COMMERCE_MJML = `<mjml>
  <mj-body background-color="#f4f8fb">
    <mj-section background-color="#e9f3fb" padding="26px 28px 18px">
      <mj-column>
        <mj-text font-size="28px" line-height="1.2" font-weight="700" color="#0f172a" padding="0 0 10px">
          New arrivals, curated for you
        </mj-text>
        <mj-text font-size="15px" color="#1e293b" padding="0">
          Top products this week from {{company}}.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px 20px 10px">
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product One
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Clean design, reliable performance, and quick setup.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$49</mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product Two
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Built for daily use with premium materials and support.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$79</mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product Three
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Compact build with premium finish and easy setup.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$99</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="0 20px 8px">
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product Four
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Made for teams that need speed, reliability, and flexibility.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$59</mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product Five
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Lightweight, practical, and optimized for daily workflows.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$69</mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Product Six
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 6px">
          Durable materials and modern styling for long-term use.
        </mj-text>
        <mj-text font-size="14px" font-weight="700" color="#0f172a" padding="0">$89</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="0 28px 24px">
      <mj-column>
        <mj-button background-color="#14b8a6" color="#ffffff" border-radius="8px" href="https://example.com/shop" inner-padding="11px 18px">
          Shop Collection
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const THREE_COLUMNS_MJML = `<mjml>
  <mj-body background-color="#f4f8fb">
    <mj-section background-color="#e9f3fb" padding="26px 28px 18px">
      <mj-column>
        <mj-text font-size="28px" line-height="1.2" font-weight="700" color="#0f172a" padding="0 0 10px">
          Highlights for this week
        </mj-text>
        <mj-text font-size="15px" color="#1e293b" padding="0">
          A quick summary of what is new.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px 20px 8px">
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+1" alt="Card 1" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update One
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          Short insight with a practical action point.
        </mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+2" alt="Card 2" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update Two
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          Important improvement rolled out to your account.
        </mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+3" alt="Card 3" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update Three
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          Tips to get better results with less effort.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="0 20px 24px">
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+4" alt="Card 4" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update Four
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          New template controls with faster editing workflow.
        </mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+5" alt="Card 5" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update Five
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          Better analytics snapshots for each campaign run.
        </mj-text>
      </mj-column>
      <mj-column width="33.33%">
        <mj-image src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+6" alt="Card 6" padding="0 0 8px" />
        <mj-text font-size="16px" font-weight="650" color="#1f2937" padding="0 0 6px">
          Update Six
        </mj-text>
        <mj-text font-size="14px" color="#334155" padding="0">
          Quality and deliverability improvements now active.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const NEWS_MJML = `<mjml>
  <mj-body background-color="#f4f8fb">
    <mj-section background-color="#e9f3fb" padding="26px 28px 18px">
      <mj-column>
        <mj-text font-size="28px" line-height="1.2" font-weight="700" color="#0f172a" padding="0 0 10px">
          Weekly Digest
        </mj-text>
        <mj-text font-size="15px" color="#1e293b" padding="0">
          Everything important from the past week.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px 20px">
      <mj-column width="68%">
        <mj-text font-size="20px" font-weight="650" color="#111827" padding="0 0 8px">
          Main Story
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 6px">
          Start with a concise summary to quickly inform your readers.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 6px">
          Highlight key updates and link to full details.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          Keep each paragraph short for better scan readability.
        </mj-text>
        <mj-divider border-color="#e2e8f0" padding="0 0 10px" />
        <mj-text font-size="14px" color="#334155" padding="0 0 5px">- Feature release details</mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 5px">- Upcoming webinar or announcement</mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 5px">- Helpful article from your team</mj-text>
        <mj-text font-size="14px" color="#334155" padding="0 0 12px">- New onboarding checklist</mj-text>
        <mj-button background-color="#14b8a6" color="#ffffff" border-radius="8px" href="https://example.com/news" inner-padding="9px 14px" width="140px" align="left">
          Read Digest
        </mj-button>
      </mj-column>
      <mj-column width="32%">
        <mj-image src="https://dummyimage.com/200x120/d9e8f4/7f9db1&text=Spotlight+1" alt="Spotlight 1" padding="0 0 10px" />
        <mj-image src="https://dummyimage.com/200x120/d9e8f4/7f9db1&text=Spotlight+2" alt="Spotlight 2" padding="0" />
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const TEXT_MJML = `<mjml>
  <mj-body background-color="#f4f8fb">
    <mj-section background-color="#e9f3fb" padding="26px 28px 18px">
      <mj-column>
        <mj-text font-size="28px" line-height="1.2" font-weight="700" color="#0f172a" padding="0 0 10px">
          Quick Update
        </mj-text>
        <mj-text font-size="15px" color="#1e293b" padding="0">
          A clean, typography-first email format.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px 28px">
      <mj-column>
        <mj-text font-size="20px" font-weight="650" color="#111827" padding="0 0 10px">
          Important Notes
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          Hello {{firstName}},
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          Here is a short update from {{company}} with only the essentials. This format is built for readability and clarity.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          We have improved dashboard speed and simplified template editing workflows.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          Campaign reports now load faster and include clearer delivery breakdowns.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0 0 10px">
          If you need help setting up flows, our support team is available anytime.
        </mj-text>
        <mj-text font-size="14px" line-height="1.65" color="#334155" padding="0">
          Thank you,<br />{{company}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export const LAYOUT_PRESET_DEFINITIONS: LayoutPresetDefinition[] = [
  {
    id: 'empty',
    label: 'Empty',
    description: 'Start with a blank canvas and build section by section.',
    starterSubject: 'Your new email template',
    starterMjml: `<mjml><mj-body><mj-section><mj-column><mj-text>Start building your template...</mj-text></mj-column></mj-section></mj-body></mjml>`,
    starterHtml: buildTemplate('<div class="content"><p>Start building your template...</p></div>'),
  },
  {
    id: 'basic',
    label: 'Basic',
    description: 'Simple hero + CTA layout for announcements.',
    starterSubject: 'Welcome to {{company}}',
    starterMjml: BASIC_MJML,
    starterHtml: buildTemplate(`
      <div class="hero">
        <h1>Welcome, {{firstName}}</h1>
        <p class="lead">We are happy to have you at {{company}}.</p>
      </div>
      <div class="content">
        <div class="section">
          <img src="https://dummyimage.com/560x140/d9e8f4/7f9db1&text=Welcome+Banner" alt="Welcome banner" style="width:100%; border-radius:8px; display:block;" />
        </div>
        <div class="section">
          <h2>Your account is ready</h2>
          <p>Everything is prepared for you.</p>
          <p>Open your dashboard and review your setup.</p>
          <p>Start your first campaign in a few steps.</p>
          <p><a class="btn" href="https://example.com">Go to Dashboard</a></p>
        </div>
        <p class="muted">Need help? Reply to this email and our team will assist you.</p>
      </div>
    `),
  },
  {
    id: 'commerce',
    label: 'Commerce',
    description: 'Product-focused layout with featured items and CTA.',
    starterSubject: 'Fresh picks selected for {{firstName}}',
    starterMjml: COMMERCE_MJML,
    starterHtml: buildTemplate(`
      <div class="hero">
        <h1>New arrivals, curated for you</h1>
        <p class="lead">Top products this week from {{company}}.</p>
      </div>
      <div class="content">
        <div class="cols-3">
          <div class="card"><h3>Product One</h3><p>Clean design, reliable performance, and quick setup.</p><p><strong>$49</strong></p></div>
          <div class="card"><h3>Product Two</h3><p>Built for daily use with premium materials and support.</p><p><strong>$79</strong></p></div>
          <div class="card"><h3>Product Three</h3><p>Compact build with premium finish and easy setup.</p><p><strong>$99</strong></p></div>
          <div class="card"><h3>Product Four</h3><p>Made for teams that need speed, reliability, and flexibility.</p><p><strong>$59</strong></p></div>
          <div class="card"><h3>Product Five</h3><p>Lightweight, practical, and optimized for daily workflows.</p><p><strong>$69</strong></p></div>
          <div class="card"><h3>Product Six</h3><p>Durable materials and modern styling for long-term use.</p><p><strong>$89</strong></p></div>
        </div>
        <p><a class="btn" href="https://example.com/shop">Shop Collection</a></p>
      </div>
    `),
  },
  {
    id: 'three-columns',
    label: 'Three columns',
    description: 'Balanced 3-column section for features or offers.',
    starterSubject: 'Top updates from {{company}}',
    starterMjml: THREE_COLUMNS_MJML,
    starterHtml: buildTemplate(`
      <div class="hero">
        <h1>Highlights for this week</h1>
        <p class="lead">A quick summary of what is new.</p>
      </div>
      <div class="content">
        <div class="cols-3">
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+1" alt="Card 1" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update One</h3><p>Short insight with a practical action point.</p></div>
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+2" alt="Card 2" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update Two</h3><p>Important improvement rolled out to your account.</p></div>
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+3" alt="Card 3" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update Three</h3><p>Tips to get better results with less effort.</p></div>
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+4" alt="Card 4" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update Four</h3><p>New template controls with faster editing workflow.</p></div>
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+5" alt="Card 5" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update Five</h3><p>Better analytics snapshots for each campaign run.</p></div>
          <div class="card"><img src="https://dummyimage.com/160x86/d9e8f4/7f9db1&text=Card+6" alt="Card 6" style="width:100%; border-radius:6px; display:block; margin-bottom:8px;" /><h3>Update Six</h3><p>Quality and deliverability improvements now active.</p></div>
        </div>
      </div>
    `),
  },
  {
    id: 'news',
    label: 'News',
    description: 'Newsletter-style digest with sections and links.',
    starterSubject: '{{company}} weekly digest',
    starterMjml: NEWS_MJML,
    starterHtml: buildTemplate(`
      <div class="hero">
        <h1>Weekly Digest</h1>
        <p class="lead">Everything important from the past week.</p>
      </div>
      <div class="content">
        <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
          <div style="flex:1 1 62%; min-width:260px;">
            <div class="section">
              <h2>Main Story</h2>
              <p>Start with a concise summary to quickly inform your readers.</p>
              <p>Highlight key updates and link to full details.</p>
              <p>Keep each paragraph short for better scan readability.</p>
            </div>
            <div class="divider"></div>
            <div class="section">
              <p>- Feature release details</p>
              <p>- Upcoming webinar or announcement</p>
              <p>- Helpful article from your team</p>
              <p>- New onboarding checklist</p>
            </div>
            <p><a class="btn" href="https://example.com/news">Read Digest</a></p>
          </div>
          <div style="flex:1 1 30%; min-width:170px;">
            <img src="https://dummyimage.com/200x120/d9e8f4/7f9db1&text=Spotlight+1" alt="Spotlight 1" style="width:100%; border-radius:8px; display:block; margin-bottom:10px;" />
            <img src="https://dummyimage.com/200x120/d9e8f4/7f9db1&text=Spotlight+2" alt="Spotlight 2" style="width:100%; border-radius:8px; display:block;" />
          </div>
        </div>
      </div>
    `),
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Lightweight plain-text style with high readability.',
    starterSubject: 'A quick update for {{firstName}}',
    starterMjml: TEXT_MJML,
    starterHtml: buildTemplate(`
      <div class="hero">
        <h1>Quick Update</h1>
        <p class="lead">A clean, typography-first email format.</p>
      </div>
      <div class="content">
        <h2>Important Notes</h2>
        <p>Hello {{firstName}},</p>
        <p>Here is a short update from {{company}} with only the essentials. This format is built for readability and clarity.</p>
        <p>We have improved dashboard speed and simplified template editing workflows.</p>
        <p>Campaign reports now load faster and include clearer delivery breakdowns.</p>
        <p>If you need help setting up flows, our support team is available anytime.</p>
        <p>Thank you,<br />{{company}}</p>
      </div>
    `),
  },
];

export function getLayoutPresetDefinition(
  preset: TemplateLayoutPreset | null | undefined,
): LayoutPresetDefinition {
  return (
    LAYOUT_PRESET_DEFINITIONS.find((item) => item.id === preset) ??
    LAYOUT_PRESET_DEFINITIONS[0]
  );
}
