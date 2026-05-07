'use client';

import { Eye, Laptop, Redo2, Smartphone, Undo2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import 'grapesjs/dist/css/grapes.min.css';
import { renderMjmlTemplate } from '@/lib/api/templates';
import { cn } from '@/lib/utils';

interface LayoutTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  designJson?: Record<string, unknown> | null;
  onDesignChange?: (design: Record<string, unknown> | null) => void;
  mjmlValue?: string | null;
  onMjmlChange?: (mjml: string | null) => void;
  headerActions?: ReactNode;
  fullHeight?: boolean;
  showHelpText?: boolean;
  previewBlocked?: boolean;
  onPreviewBlocked?: () => void;
}

interface GrapesEditorInstance {
  getHtml: () => string;
  getWrapper?: () => {
    toHTML?: () => string;
    getInnerHTML?: () => string;
  };
  getSelected?: () => unknown;
  select?: (component: unknown) => void;
  setComponents: (input: string) => void;
  setDevice?: (name: string) => void;
  runCommand?: (id: string) => unknown;
  stopCommand?: (id: string) => unknown;
  on: (eventName: string, callback: (...args: unknown[]) => void) => void;
  destroy: () => void;
  DomComponents?: {
    getType?: (type: string) => unknown;
  };
  UndoManager?: {
    undo: (all?: boolean) => void;
    redo: (all?: boolean) => void;
  };
  Canvas?: {
    getBody?: () => HTMLBodyElement | null;
    getDocument?: () => Document | null;
    getWindow?: () => Window | null;
    getFrameEl?: () => HTMLIFrameElement | null;
  };
}

interface GrapesComponentModel {
  get: (key: string) => unknown;
  set: (key: string, value: unknown, options?: { silent?: boolean }) => void;
  getStyle: () => Record<string, string>;
  setStyle: (style: Record<string, string>) => void;
  getAttributes: () => Record<string, string>;
  setAttributes: (attrs: Record<string, string>) => void;
  toHTML?: () => string;
  getEl?: () => HTMLElement | null;
  getTrait?: (id: string) => unknown;
  getTraits?: () => Array<{ get?: (key: string) => unknown }>;
  addTrait?: (trait: TraitDefinition | TraitDefinition[]) => unknown;
}

type TraitOption = { id: string; label: string };
type TraitDefinition = {
  type?: string;
  name: string;
  label?: string;
  placeholder?: string;
  options?: TraitOption[];
};

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stripSingleWrapperAnchor(content: string): string {
  const match = content.trim().match(/^<a\b[^>]*>([\s\S]*)<\/a>$/i);
  return match?.[1] ?? content;
}

function stripAllAnchors(content: string): string {
  const source = content.trim();
  if (!source) {
    return '';
  }

  if (typeof window !== 'undefined') {
    const host = window.document.createElement('div');
    host.innerHTML = source;
    host.querySelectorAll('a').forEach((anchor) => {
      const parent = anchor.parentNode;
      if (!parent) {
        return;
      }

      while (anchor.firstChild) {
        parent.insertBefore(anchor.firstChild, anchor);
      }
      parent.removeChild(anchor);
    });
    return host.innerHTML.trim();
  }

  return source.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1').trim();
}

function extractWrapperAnchorDetails(
  content: string,
): { href: string; target: string; inner: string } | null {
  const source = content.trim();
  if (!source) {
    return null;
  }

  const anchorMatch = source.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) {
    return null;
  }

  const attrs = anchorMatch[1] ?? '';
  const hrefMatch = attrs.match(/\bhref=(["'])(.*?)\1/i);
  const href = hrefMatch?.[2]?.trim() ?? '';
  if (!href) {
    return null;
  }

  const targetMatch = attrs.match(/\btarget=(["'])(.*?)\1/i);
  return {
    href,
    target: targetMatch?.[2]?.trim() || '_self',
    inner: anchorMatch[2] ?? '',
  };
}

function extractInnerTextHtmlCandidate(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  // If already plain/inline html content, keep as-is.
  if (!/<(td|tr|tbody|table)\b/i.test(trimmed)) {
    return trimmed;
  }

  // For compiled email wrappers, parse and keep the full visible content inside the first table cell.
  if (typeof window !== 'undefined') {
    const host = window.document.createElement('div');
    host.innerHTML = trimmed;
    const td = host.querySelector('td');
    const tdInner = td?.innerHTML?.trim() ?? '';
    if (tdInner) {
      return tdInner;
    }
  }

  // Fallback regex extraction for environments where DOM is unavailable.
  const tdMatch = trimmed.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
  if (tdMatch?.[1]?.trim()) {
    return tdMatch[1].trim();
  }

  // Fallback to plain text extraction from wrapper markup.
  return htmlToPlainText(trimmed);
}

function getComponentEditableContent(component: GrapesComponentModel | null): string {
  if (!component) {
    return '';
  }

  const rawContent = String(component.get?.('content') ?? '').trim();
  if (rawContent) {
    return extractInnerTextHtmlCandidate(rawContent);
  }

  const el = component.getEl?.();
  if (el) {
    const elementContent = el.innerHTML?.trim() ?? '';
    if (elementContent) {
      return extractInnerTextHtmlCandidate(elementContent);
    }
  }

  const serialized = component.toHTML?.().trim() ?? '';
  if (serialized) {
    return extractInnerTextHtmlCandidate(serialized);
  }

  return '';
}

function applyTextLinkToComponent(
  component: GrapesComponentModel,
  input: { href: string; target?: string },
): void {
  const href = input.href.trim();
  const target = input.target?.trim() || '_self';
  const currentContent = getComponentEditableContent(component);
  const cleanContent = stripAllAnchors(stripSingleWrapperAnchor(currentContent));

  if (!href) {
    if (cleanContent !== currentContent) {
      component.set('content', cleanContent);
    }
    return;
  }

  // Never overwrite content with an empty anchor.
  if (!cleanContent.trim()) {
    return;
  }

  const wrappedBlockMatch = cleanContent.match(/^<(div|p|span)\b([^>]*)>([\s\S]*)<\/\1>$/i);
  const linkedContent = wrappedBlockMatch
    ? `<${wrappedBlockMatch[1]}${wrappedBlockMatch[2]}><a href="${escapeHtmlAttr(href)}" target="${escapeHtmlAttr(target)}">${wrappedBlockMatch[3]}</a></${wrappedBlockMatch[1]}>`
    : `<a href="${escapeHtmlAttr(href)}" target="${escapeHtmlAttr(target)}">${cleanContent}</a>`;
  if (linkedContent !== currentContent) {
    component.set('content', linkedContent);
  }
}

function migrateLegacyTextLinkAttributes(component: GrapesComponentModel): void {
  if (String(component.get('type') ?? '') !== 'mj-text') {
    return;
  }

  const attrs = component.getAttributes?.() ?? {};
  const legacyHref = attrs['data-text-link-href']?.trim() ?? '';
  const legacyTarget = attrs['data-text-link-target']?.trim() || '_self';
  const hasLegacyAttrs =
    Object.prototype.hasOwnProperty.call(attrs, 'data-text-link-href') ||
    Object.prototype.hasOwnProperty.call(attrs, 'data-text-link-target');

  if (legacyHref) {
    applyTextLinkToComponent(component, {
      href: legacyHref,
      target: legacyTarget,
    });
  }

  if (!hasLegacyAttrs) {
    return;
  }

  const nextAttrs = { ...attrs };
  delete nextAttrs['data-text-link-href'];
  delete nextAttrs['data-text-link-target'];
  component.setAttributes(nextAttrs);
}

function decodeHtmlEntities(input: string): string {
  if (typeof window === 'undefined') {
    return input
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
  }

  const textarea = window.document.createElement('textarea');
  textarea.innerHTML = input;
  return textarea.value;
}

function htmlToPlainText(input: string): string {
  const withLineBreaks = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withLineBreaks).replace(/\n{3,}/g, '\n\n').trim();
}

function plainTextToHtml(input: string): string {
  const escaped = input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  return escaped.replace(/\r?\n/g, '<br>');
}

function pxValue(input: string): string {
  const raw = input.trim();
  if (!raw) {
    return '';
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return `${raw}px`;
  }
  return raw;
}

function fromCssUrl(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^url\((['"]?)(.*?)\1\)$/i);
  return match?.[2] ?? trimmed;
}

function toCssUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  return `url("${trimmed.replaceAll('"', '\\"')}")`;
}

const STARTER_MJML = `<mjml>
  <mj-body background-color="#f5f5f5">
    <mj-section background-color="#ffffff" padding="24px 20px">
      <mj-column>
        <mj-text font-size="28px" font-weight="700" color="#111827">Main Heading</mj-text>
        <mj-text color="#4b5563" line-height="1.7">
          Add your message here and customize this professional template using drag-and-drop blocks.
        </mj-text>
        <mj-button background-color="#0f766e" color="#ffffff" href="https://example.com">
          Call to Action
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

function ensureMjmlDocument(input: string | null | undefined): string {
  const source = (input ?? '').trim();
  if (!source) {
    return STARTER_MJML;
  }

  if (source.includes('<mjml')) {
    return source;
  }

  return STARTER_MJML;
}

function toMjmlFromEditor(editor: GrapesEditorInstance): string {
  const wrapper = editor.getWrapper?.();
  const raw = wrapper?.toHTML?.() ?? wrapper?.getInnerHTML?.() ?? editor.getHtml();
  const trimmed = raw.trim();

  if (trimmed.includes('<mjml')) {
    return trimmed;
  }

  return `<mjml><mj-body>${trimmed}</mj-body></mjml>`;
}

export function LayoutTemplateEditor({
  value,
  onChange,
  designJson = null,
  onDesignChange,
  mjmlValue = null,
  onMjmlChange,
  headerActions,
  fullHeight = false,
  showHelpText = true,
  previewBlocked = false,
  onPreviewBlocked,
}: LayoutTemplateEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<GrapesEditorInstance | null>(null);
  const selectedComponentRef = useRef<GrapesComponentModel | null>(null);
  const onChangeRef = useRef(onChange);
  const onMjmlChangeRef = useRef(onMjmlChange);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCanvasRef = useRef<(() => void) | null>(null);
  const syncVersionRef = useRef(0);
  const lastHtmlRef = useRef(value);
  const initialMjmlRef = useRef(ensureMjmlDocument(mjmlValue));
  const lastEmittedMjmlRef = useRef(initialMjmlRef.current);
  const lastAppliedExternalMjmlRef = useRef(initialMjmlRef.current);
  const [activeRightPanel, setActiveRightPanel] = useState<'styles' | 'traits' | 'layers'>(
    'styles',
  );
  const [activeDevice, setActiveDevice] = useState<'Desktop' | 'Mobile'>('Desktop');
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<GrapesComponentModel | null>(null);
  const [, forceSelectedComponentRefresh] = useState(0);

  const shellId = useMemo(() => `mjml-shell-${Math.random().toString(36).slice(2, 10)}`, []);
  const layoutTargets = useMemo(
    () => ({
      blocks: `${shellId}-blocks`,
      styles: `${shellId}-styles`,
      traits: `${shellId}-traits`,
      layers: `${shellId}-layers`,
    }),
    [shellId],
  );

  const runPreviewToggle = () => {
    if (!previewMode && previewBlocked) {
      onPreviewBlocked?.();
      return;
    }
    setPreviewMode((prev) => !prev);
  };

  const setDevice = (name: 'Desktop' | 'Mobile') => {
    editorRef.current?.setDevice?.(name);
    setActiveDevice(name);
    setTimeout(() => refreshCanvasRef.current?.(), 0);
  };

  const bumpSelectedComponent = () => {
    forceSelectedComponentRefresh((prev) => prev + 1);
  };

  const keepComponentSelected = (component: GrapesComponentModel | null) => {
    setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const currentlySelected = editor.getSelected?.() as GrapesComponentModel | null;
      if (currentlySelected) {
        setSelectedComponent(currentlySelected);
        bumpSelectedComponent();
        return;
      }

      if (!component) {
        return;
      }

      editor.select?.(component);
      const selectedAfterRestore = editor.getSelected?.() as GrapesComponentModel | null;
      setSelectedComponent(selectedAfterRestore ?? component);
      bumpSelectedComponent();
    }, 0);
  };

  useEffect(() => {
    selectedComponentRef.current = selectedComponent;
  }, [selectedComponent]);

  const updateSelectedAttributes = (updates: Record<string, string>) => {
    if (!selectedComponent) {
      return;
    }
    const attrs = selectedComponent.getAttributes?.() ?? {};
    selectedComponent.setAttributes({
      ...attrs,
      ...updates,
    });
  };

  const updateSelectedStyle = (updates: Record<string, string>) => {
    if (!selectedComponent) {
      return;
    }
    const current = selectedComponent.getStyle?.() ?? {};
    selectedComponent.setStyle({
      ...current,
      ...updates,
    });
  };

  const ensureComponentTraits = (component: unknown) => {
    const cmp = component as {
      get?: (key: string) => unknown;
      getTraits?: () => Array<{ get?: (key: string) => unknown }>;
      addTrait?: (trait: TraitDefinition | TraitDefinition[]) => unknown;
      getAttributes?: () => Record<string, string>;
      setAttributes?: (attrs: Record<string, string>) => void;
      getTrait?: (name: string) => unknown;
    } | null;
    if (!cmp) {
      return;
    }

    const existingNames = new Set(
      (cmp.getTraits?.() ?? [])
        .map((trait) => String(trait?.get?.('name') ?? '').trim())
        .filter(Boolean),
    );
    const addTraits = (traits: TraitDefinition[]) => {
      const missing = traits.filter((trait) => !existingNames.has(trait.name));
      if (missing.length > 0) {
        cmp.addTrait?.(missing);
      }
    };

    const type = String(cmp.get?.('type') ?? '');
    if (type === 'mj-image') {
      addTraits([
        { type: 'text', name: 'href', label: 'Image Link', placeholder: 'https://example.com' },
        {
          type: 'select',
          name: 'target',
          label: 'Link Target',
          options: [
            { id: '', label: 'Same tab' },
            { id: '_blank', label: 'New tab' },
          ],
        },
        { type: 'text', name: 'alt', label: 'Alt Text', placeholder: 'Describe image' },
        { type: 'text', name: 'title', label: 'Image Title', placeholder: 'Optional title' },
      ]);
      return;
    }

    if (type === 'mj-button') {
      addTraits([
        { type: 'text', name: 'href', label: 'Button Link', placeholder: 'https://example.com' },
        {
          type: 'select',
          name: 'target',
          label: 'Link Target',
          options: [
            { id: '', label: 'Same tab' },
            { id: '_blank', label: 'New tab' },
          ],
        },
        { type: 'text', name: 'title', label: 'Button Title', placeholder: 'Optional title' },
      ]);
      return;
    }

    if (type === 'mj-text') {
      migrateLegacyTextLinkAttributes(cmp as unknown as GrapesComponentModel);
      return;
    }

    if (type === 'mj-navbar-link' || type === 'mj-social-element') {
      addTraits([
        { type: 'text', name: 'href', label: 'Link URL', placeholder: 'https://example.com' },
        {
          type: 'select',
          name: 'target',
          label: 'Link Target',
          options: [
            { id: '', label: 'Same tab' },
            { id: '_blank', label: 'New tab' },
          ],
        },
      ]);
    }
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onMjmlChangeRef.current = onMjmlChange;
  }, [onMjmlChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !fullHeight) {
      return;
    }

    try {
      if (previewMode) {
        editor.runCommand?.('preview');
      } else {
        editor.stopCommand?.('preview');
      }
    } catch {
      // Keep UI responsive even if command state is temporarily unavailable.
    }
  }, [fullHeight, previewMode]);

  useEffect(() => {
    if (designJson && onDesignChange) {
      onDesignChange(designJson);
    }
  }, [designJson, onDesignChange]);

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!containerRef.current || editorRef.current) {
        return;
      }

      const grapesjs = (await import('grapesjs')).default;
      const grapesMjml = (await import('grapesjs-mjml')).default;
      if (disposed || !containerRef.current) {
        return;
      }

      const editor = grapesjs.init({
        container: containerRef.current,
        fromElement: false,
        storageManager: false,
        noticeOnUnload: false,
        height: fullHeight ? '900px' : '78vh',
        panels: fullHeight ? { defaults: [] } : undefined,
        blockManager: fullHeight ? { appendTo: `#${layoutTargets.blocks}` } : undefined,
        styleManager: fullHeight ? { appendTo: `#${layoutTargets.styles}` } : undefined,
        traitManager: fullHeight ? { appendTo: `#${layoutTargets.traits}` } : undefined,
        layerManager: fullHeight ? { appendTo: `#${layoutTargets.layers}` } : undefined,
        deviceManager: fullHeight
          ? {
              devices: [
                { id: 'Desktop', name: 'Desktop', width: '100%' },
                { id: 'Mobile', name: 'Mobile', width: '375px', widthMedia: '480px' },
              ],
            }
          : undefined,
        plugins: [
          (instance: unknown) =>
            grapesMjml(instance as never, {
              resetBlocks: true,
              resetDevices: !fullHeight,
              resetStyleManager: true,
              hideSelector: false,
              useCustomTheme: false,
            }),
        ],
        components: initialMjmlRef.current,
      }) as GrapesEditorInstance;

      editorRef.current = editor;

      if (fullHeight) {
        editor.setDevice?.('Desktop');
      }

      const ensureCanvasScroll = () => {
        const frameBody = editor.Canvas?.getBody?.();
        const frameDoc = editor.Canvas?.getDocument?.();
        const frameEl = editor.Canvas?.getFrameEl?.();
        if (frameBody) {
          frameBody.style.overflowY = 'visible';
          frameBody.style.overflowX = 'visible';
          frameBody.style.height = 'auto';
          frameBody.style.minHeight = 'auto';
          frameBody.style.background = 'transparent';
        }
        if (frameDoc?.documentElement) {
          frameDoc.documentElement.style.overflowY = 'visible';
          frameDoc.documentElement.style.overflowX = 'visible';
          frameDoc.documentElement.style.height = 'auto';
          frameDoc.documentElement.style.minHeight = 'auto';
          frameDoc.documentElement.style.background = 'transparent';
        }
        if (frameEl) {
          frameEl.style.overflow = 'visible';
          frameEl.setAttribute('scrolling', 'no');
        }

        const frameRoot = frameDoc?.documentElement;
        const contentHeight = Math.max(
          frameBody?.scrollHeight ?? 0,
          frameRoot?.scrollHeight ?? 0,
          700,
        );
        const adjustedHeight = `${contentHeight + 32}px`;

        const editorEl = containerRef.current?.querySelector('.gjs-editor') as HTMLElement | null;
        const editorContEl = containerRef.current?.querySelector('.gjs-editor-cont') as HTMLElement | null;
        const canvasEl = containerRef.current?.querySelector('.gjs-cv-canvas') as HTMLElement | null;
        const frameWrapperEl = containerRef.current?.querySelector('.gjs-frame-wrapper') as HTMLElement | null;

        if (containerRef.current) {
          containerRef.current.style.height = adjustedHeight;
        }
        if (editorEl) editorEl.style.height = adjustedHeight;
        if (editorContEl) editorContEl.style.height = adjustedHeight;
        if (canvasEl) canvasEl.style.height = adjustedHeight;
        if (frameWrapperEl) frameWrapperEl.style.height = adjustedHeight;
        if (frameEl) frameEl.style.height = adjustedHeight;

        if (frameDoc && !frameDoc.getElementById('mjml-frame-ux-fixes')) {
          const styleEl = frameDoc.createElement('style');
          styleEl.id = 'mjml-frame-ux-fixes';
          styleEl.textContent = `
            .gjs-selected,
            .gjs-hovered,
            .gjs-selected-parent,
            .gjs-comp-selected {
              opacity: 1 !important;
              filter: none !important;
            }

            .gjs-dashed * {
              opacity: 1 !important;
            }
          `;
          frameDoc.head.appendChild(styleEl);
        }
      };

      refreshCanvasRef.current = ensureCanvasScroll;

      editor.on('load', ensureCanvasScroll);
      editor.on('update', ensureCanvasScroll);
      editor.on('component:selected', (component) => {
        if (!fullHeight) {
          return;
        }
        ensureComponentTraits(component);
        setSelectedComponent(component as GrapesComponentModel);
        bumpSelectedComponent();
        setActiveRightPanel('traits');
      });
      editor.on('component:deselected', () => {
        const currentSelected = editor.getSelected?.() as GrapesComponentModel | null;
        if (currentSelected) {
          setSelectedComponent(currentSelected);
          bumpSelectedComponent();
          return;
        }
        setSelectedComponent(null);
        bumpSelectedComponent();
      });
      editor.on('component:update:attributes', (component) => {
        const cmp = component as GrapesComponentModel;
        migrateLegacyTextLinkAttributes(cmp);
        if (selectedComponentRef.current && cmp === selectedComponentRef.current) {
          bumpSelectedComponent();
        }
      });
      editor.on('component:styleUpdate', (component) => {
        const cmp = component as GrapesComponentModel;
        if (selectedComponentRef.current && cmp === selectedComponentRef.current) {
          bumpSelectedComponent();
        }
      });
      editor.on('component:update', (component) => {
        const cmp = component as GrapesComponentModel;
        if (selectedComponentRef.current && cmp === selectedComponentRef.current) {
          bumpSelectedComponent();
        }
      });
      ensureCanvasScroll();

      const syncCompiledHtml = async () => {
        const mjml = toMjmlFromEditor(editor);
        lastEmittedMjmlRef.current = mjml;
        onMjmlChangeRef.current?.(mjml);

        const currentVersion = ++syncVersionRef.current;
        try {
          const rendered = await renderMjmlTemplate(mjml);
          if (disposed || currentVersion !== syncVersionRef.current) {
            return;
          }

          if (rendered.html) {
            lastHtmlRef.current = rendered.html;
            onChangeRef.current(rendered.html);
            return;
          }
        } catch {
          // Fallback to current editor output if remote render fails.
        }

        const fallbackHtml = editor.getHtml();
        if (!disposed && currentVersion === syncVersionRef.current) {
          lastHtmlRef.current = fallbackHtml;
          onChangeRef.current(fallbackHtml);
        }
      };

      editor.on('update', () => {
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
        }

        updateTimerRef.current = setTimeout(() => {
          void syncCompiledHtml();
        }, 650);
      });

      void syncCompiledHtml();
    }

    void init();

    return () => {
      disposed = true;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
      refreshCanvasRef.current = null;
    };
  }, [fullHeight, layoutTargets.blocks, layoutTargets.layers, layoutTargets.styles, layoutTargets.traits]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (!mjmlValue) {
      return;
    }

    const normalized = ensureMjmlDocument(mjmlValue);
    if (
      normalized === initialMjmlRef.current ||
      normalized === lastEmittedMjmlRef.current ||
      normalized === lastAppliedExternalMjmlRef.current
    ) {
      return;
    }

    const currentInEditor = toMjmlFromEditor(editor);
    if (normalized === currentInEditor) {
      lastAppliedExternalMjmlRef.current = normalized;
      return;
    }

    editor.setComponents(normalized);
    lastAppliedExternalMjmlRef.current = normalized;
    initialMjmlRef.current = normalized;
  }, [mjmlValue]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (!value || value === lastHtmlRef.current) {
      return;
    }

    lastHtmlRef.current = value;
  }, [value]);

  const selectedType = String(selectedComponent?.get?.('type') ?? '');
  const selectedAttributes = selectedComponent?.getAttributes?.() ?? {};
  const selectedStyles = selectedComponent?.getStyle?.() ?? {};
  const selectedTextContent = htmlToPlainText(getComponentEditableContent(selectedComponent));
  const selectedImageSrc = selectedAttributes.src ?? '';
  const selectedImageAlt = selectedAttributes.alt ?? '';
  const selectedImageTitle = selectedAttributes.title ?? '';
  const selectedImageHref = selectedAttributes.href ?? '';
  const selectedImageTarget = selectedAttributes.target ?? '';
  const selectedImageMaxWidth = selectedAttributes.width ?? selectedStyles.width ?? '';
  const selectedImageAlign = selectedAttributes.align ?? selectedStyles['text-align'] ?? 'center';
  const selectedHoverImage = selectedAttributes['data-hover-src'] ?? '';
  const selectedBackgroundColor =
    selectedStyles['background-color'] ?? selectedAttributes['background-color'] ?? '';
  const selectedBackgroundImage = fromCssUrl(selectedStyles['background-image'] ?? '');
  const selectedPaddingTop =
    selectedStyles['padding-top'] ?? selectedAttributes['padding-top'] ?? '';
  const selectedPaddingRight =
    selectedStyles['padding-right'] ?? selectedAttributes['padding-right'] ?? '';
  const selectedPaddingBottom =
    selectedStyles['padding-bottom'] ?? selectedAttributes['padding-bottom'] ?? '';
  const selectedPaddingLeft =
    selectedStyles['padding-left'] ?? selectedAttributes['padding-left'] ?? '';
  const selectedHeight = selectedStyles.height ?? selectedAttributes.height ?? '';
  const selectedBorderRadius =
    selectedStyles['border-radius'] ?? selectedAttributes['border-radius'] ?? '';
  const selectedBorder = selectedStyles.border ?? selectedAttributes.border ?? '';
  const selectedTextColor = selectedStyles.color ?? selectedAttributes.color ?? '';
  const selectedFontFamily = selectedStyles['font-family'] ?? selectedAttributes['font-family'] ?? '';
  const selectedLineHeight = selectedStyles['line-height'] ?? selectedAttributes['line-height'] ?? '';
  const selectedButtonText = selectedTextContent;
  const selectedButtonHref = selectedAttributes.href ?? '';
  const selectedButtonTarget = selectedAttributes.target ?? '';
  const selectedButtonTitle = selectedAttributes.title ?? '';
  const selectedGenericHref = selectedAttributes.href ?? '';
  const selectedGenericTarget = selectedAttributes.target ?? '';

  const isTextComponent = selectedType === 'mj-text';
  const isImageComponent = selectedType === 'mj-image';
  const isButtonComponent = selectedType === 'mj-button';
  const selectedTextAnchor = isTextComponent
    ? extractWrapperAnchorDetails(getComponentEditableContent(selectedComponent))
    : null;
  const selectedTextLink = selectedTextAnchor?.href ?? '';
  const selectedTextLinkTarget = selectedTextAnchor?.target ?? '_self';
  const isLinkableComponent =
    isImageComponent ||
    isButtonComponent ||
    isTextComponent ||
    selectedType === 'mj-navbar-link' ||
    selectedType === 'mj-social-element';
  const selectedComponentLabel = isImageComponent
    ? 'Picture'
    : isButtonComponent
      ? 'Button'
      : isTextComponent
        ? 'Text block'
        : 'Component';

  const imageFileName = selectedImageSrc.split('/').pop() ?? 'image';
  const imageSize = `${selectedAttributes.width ?? selectedStyles.width ?? '-'} x ${
    selectedAttributes.height ?? selectedStyles.height ?? '-'
  }`;

  if (fullHeight) {
    return (
      <div className="mjml-editor-theme mjml-shell flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-slate-100">
        <div className="mjml-shell__topbar flex items-center justify-between gap-3 border-b border-[#0c5f79] bg-[#064a63] px-4 py-2 text-white">
          <div className="text-sm font-semibold">Drag&Drop Editor</div>
          <div className="flex items-center gap-2">
            {headerActions ? <div className="mr-2 flex items-center gap-2">{headerActions}</div> : null}
            <div className="inline-flex overflow-hidden rounded-md border border-[#1d718d] bg-[#0f5b76]">
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1 px-3 text-xs font-medium',
                  activeDevice === 'Desktop' ? 'bg-[#0a6f90]' : 'hover:bg-[#0c6784]',
                )}
                onClick={() => setDevice('Desktop')}
              >
                <Laptop className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1 border-l border-[#1d718d] px-3 text-xs font-medium',
                  activeDevice === 'Mobile' ? 'bg-[#0a6f90]' : 'hover:bg-[#0c6784]',
                )}
                onClick={() => setDevice('Mobile')}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#1d718d] bg-[#0f5b76] hover:bg-[#0c6784]"
              onClick={() => editorRef.current?.UndoManager?.undo()}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#1d718d] bg-[#0f5b76] hover:bg-[#0c6784]"
              onClick={() => editorRef.current?.UndoManager?.redo()}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold',
                previewMode
                  ? 'border-[#99d9f0] bg-[#cfeef9] text-[#0a4f68]'
                  : previewBlocked
                    ? 'cursor-not-allowed border-[#1d718d] bg-[#0f5b76] text-white/70'
                    : 'border-[#1d718d] bg-[#0f5b76] text-white hover:bg-[#0c6784]',
              )}
              onClick={runPreviewToggle}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>
        </div>

        <div className="grid h-full min-h-0 flex-1 grid-cols-[108px_minmax(0,1fr)_320px] overflow-hidden">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-300 bg-[#eef3f6] p-2">
            <div className="rounded-md border border-[#cdd7df] bg-white p-2 text-center text-xs font-semibold text-[#1f4f68]">
              Blocks
            </div>
            <div id={layoutTargets.blocks} className="editor-pane-scroll mt-2 min-h-0 flex-1 overflow-y-auto" />
          </aside>

          <main className="relative min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-[#dfe3e7]">
            <div className="min-h-full w-full px-4 py-4">
              <div
                className="min-h-[58vh] overflow-visible rounded-md border border-[#c9d4de] bg-transparent"
                ref={containerRef}
              />
            </div>
          </main>

          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-slate-300 bg-[#f3f6f8]">
            <div className="flex border-b border-slate-300">
              {[
                { key: 'styles', label: 'Styles' },
                { key: 'traits', label: 'Settings' },
                { key: 'layers', label: 'Layers' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={cn(
                    'flex-1 border-r border-slate-300 px-3 py-2 text-xs font-semibold last:border-r-0',
                    activeRightPanel === tab.key
                      ? 'bg-white text-[#0b6886]'
                      : 'bg-[#ecf1f5] text-slate-600 hover:bg-white',
                  )}
                  onClick={() => setActiveRightPanel(tab.key as 'styles' | 'traits' | 'layers')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="editor-pane-scroll min-h-0 flex-1 overflow-y-auto p-2">
              <div className={cn(activeRightPanel === 'styles' ? 'block' : 'hidden')} id={layoutTargets.styles} />
              <div className={cn(activeRightPanel === 'traits' ? 'block' : 'hidden')}>
                {selectedComponent ? (
                  <div className="space-y-4 rounded-md border border-slate-300 bg-white p-3">
                    <div className="text-sm font-semibold text-[#0b6886]">{selectedComponentLabel}</div>

                    {isTextComponent ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Text block</span>
                          <textarea
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            rows={4}
                            value={selectedTextContent}
                            onChange={(event) => {
                              const nextTextHtml = plainTextToHtml(event.target.value);
                              if (!selectedTextLink) {
                                selectedComponent.set('content', nextTextHtml);
                              } else {
                                const target = selectedTextLinkTarget || '_self';
                                selectedComponent.set(
                                  'content',
                                  `<a href="${escapeHtmlAttr(selectedTextLink)}" target="${escapeHtmlAttr(target)}">${nextTextHtml}</a>`,
                                );
                              }
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Text color</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextColor}
                            onChange={(event) => updateSelectedStyle({ color: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Font</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedFontFamily}
                            onChange={(event) => updateSelectedStyle({ 'font-family': event.target.value })}
                          >
                            <option value="">Default</option>
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                            <option value="Tahoma, sans-serif">Tahoma</option>
                            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                            <option value="'Courier New', monospace">Courier New</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Line height</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedLineHeight}
                            onChange={(event) =>
                              updateSelectedStyle({
                                'line-height': event.target.value.trim() ? pxValue(event.target.value) : '',
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Add a link</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextLink}
                            placeholder="https://example.com"
                            onChange={(event) => {
                              if (!selectedComponent) {
                                return;
                              }
                              applyTextLinkToComponent(selectedComponent, {
                                href: event.target.value,
                                target: selectedTextLinkTarget,
                              });
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link Target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextLinkTarget}
                            onChange={(event) => {
                              if (!selectedComponent || !selectedTextLink) {
                                return;
                              }
                              applyTextLinkToComponent(selectedComponent, {
                                href: selectedTextLink,
                                target: event.target.value,
                              });
                              keepComponentSelected(selectedComponent);
                            }}
                          >
                            <option value="_self">Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    {isImageComponent ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Picture URL</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageSrc}
                            onChange={(event) => updateSelectedAttributes({ src: event.target.value.trim() })}
                          />
                        </label>
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                          <div>Image Name: {imageFileName}</div>
                          <div>Image Size: {imageSize}</div>
                        </div>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedHoverImage)}
                              onChange={(event) =>
                                updateSelectedAttributes({
                                  'data-hover-src': event.target.checked ? selectedImageSrc : '',
                                })
                              }
                            />
                            Change image on hover
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedHoverImage}
                            placeholder="https://example.com/hover-image.jpg"
                            onChange={(event) =>
                              updateSelectedAttributes({ 'data-hover-src': event.target.value.trim() })
                            }
                          />
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Alternative text</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageAlt}
                            onChange={(event) => updateSelectedAttributes({ alt: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Image Title</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageTitle}
                            onChange={(event) => updateSelectedAttributes({ title: event.target.value })}
                          />
                        </label>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedImageHref)}
                              onChange={(event) =>
                                updateSelectedAttributes({
                                  href: event.target.checked ? selectedImageHref || 'https://example.com' : '',
                                })
                              }
                            />
                            Add a link
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageHref}
                            placeholder="https://example.com"
                            onChange={(event) => updateSelectedAttributes({ href: event.target.value.trim() })}
                          />
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageTarget}
                            onChange={(event) => updateSelectedAttributes({ target: event.target.value })}
                          >
                            <option value="">Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            Maximum picture width
                          </span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageMaxWidth}
                            placeholder="100% or 600px"
                            onChange={(event) =>
                              updateSelectedAttributes({
                                width: event.target.value.trim() ? pxValue(event.target.value) : '',
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Alignment</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageAlign}
                            onChange={(event) => updateSelectedAttributes({ align: event.target.value })}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    {isButtonComponent ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Button text</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonText}
                            onChange={(event) => {
                              selectedComponent.set('content', plainTextToHtml(event.target.value));
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Add a link</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonHref}
                            placeholder="https://example.com"
                            onChange={(event) => updateSelectedAttributes({ href: event.target.value.trim() })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonTarget}
                            onChange={(event) => updateSelectedAttributes({ target: event.target.value })}
                          >
                            <option value="">Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Title</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonTitle}
                            onChange={(event) => updateSelectedAttributes({ title: event.target.value })}
                          />
                        </label>
                      </div>
                    ) : null}

                    {isLinkableComponent && !isTextComponent && !isImageComponent && !isButtonComponent ? (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Add a link</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedGenericHref}
                            placeholder="https://example.com"
                            onChange={(event) => updateSelectedAttributes({ href: event.target.value.trim() })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedGenericTarget}
                            onChange={(event) => updateSelectedAttributes({ target: event.target.value })}
                          >
                            <option value="">Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    <div className="border-t border-slate-200 pt-3">
                      <div className="mb-2 text-xs font-semibold text-[#0b6886]">Component settings</div>
                      <div className="grid grid-cols-1 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Background color</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedBackgroundColor}
                            onChange={(event) =>
                              updateSelectedStyle({ 'background-color': event.target.value.trim() })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Background image</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedBackgroundImage}
                            placeholder="https://example.com/bg.png"
                            onChange={(event) =>
                              updateSelectedStyle({
                                'background-image': event.target.value.trim()
                                  ? toCssUrl(event.target.value.trim())
                                  : '',
                              })
                            }
                          />
                        </label>
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Inner Padding</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingTop}
                              placeholder="Top"
                              onChange={(event) =>
                                updateSelectedStyle({ 'padding-top': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingBottom}
                              placeholder="Bottom"
                              onChange={(event) =>
                                updateSelectedStyle({ 'padding-bottom': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingLeft}
                              placeholder="Left"
                              onChange={(event) =>
                                updateSelectedStyle({ 'padding-left': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingRight}
                              placeholder="Right"
                              onChange={(event) =>
                                updateSelectedStyle({ 'padding-right': pxValue(event.target.value) })
                              }
                            />
                          </div>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Height</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedHeight}
                            onChange={(event) => updateSelectedStyle({ height: pxValue(event.target.value) })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Round corners</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedBorderRadius}
                            onChange={(event) =>
                              updateSelectedStyle({ 'border-radius': pxValue(event.target.value) })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Contour</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedBorder}
                            placeholder="1px solid #000000"
                            onChange={(event) => updateSelectedStyle({ border: event.target.value.trim() })}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-600">
                    Select an element to see its settings.
                  </div>
                )}
                <div id={layoutTargets.traits} className="mt-3" />
              </div>
              <div className={cn(activeRightPanel === 'layers' ? 'block' : 'hidden')} id={layoutTargets.layers} />
            </div>
          </aside>
        </div>

        <style jsx global>{`
          .mjml-shell .gjs-editor,
          .mjml-shell .gjs-editor-cont,
          .mjml-shell .gjs-cv-canvas,
          .mjml-shell .gjs-frame-wrapper {
            top: 0 !important;
          }

          .mjml-shell .gjs-editor-cont {
            background: transparent !important;
          }

          .mjml-shell .gjs-cv-canvas {
            overflow: visible !important;
            background: transparent !important;
          }

          .mjml-shell .gjs-frame-wrapper,
          .mjml-shell .gjs-frame {
            overflow: visible !important;
            background: transparent !important;
          }

          .mjml-shell .editor-pane-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .mjml-shell .editor-pane-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }

          .mjml-shell .gjs-pn-panels,
          .mjml-shell .gjs-pn-views-container,
          .mjml-shell .gjs-pn-options,
          .mjml-shell .gjs-pn-devices-c,
          .mjml-shell .gjs-pn-views,
          .mjml-shell .gjs-pn-buttons {
            display: none !important;
          }

          .mjml-shell .gjs-blocks-c {
            padding: 0 !important;
          }

          .mjml-shell .gjs-block {
            width: 100% !important;
            min-height: 74px !important;
            margin: 0 0 8px !important;
            border: 1px solid #cdd7df !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          .mjml-shell .gjs-block:hover {
            border-color: #56b7da !important;
            background: #f4fbfe !important;
          }

          .mjml-shell .gjs-block-label {
            color: #31556a !important;
            font-size: 12px !important;
            font-weight: 600 !important;
          }

          .mjml-shell .gjs-sm-sector-title,
          .mjml-shell .gjs-trt-trait__label,
          .mjml-shell .gjs-layer-title {
            color: #334155 !important;
          }

          .mjml-shell .gjs-sm-sector-title,
          .mjml-shell .gjs-sm-label,
          .mjml-shell .gjs-sm-property,
          .mjml-shell .gjs-sm-clear,
          .mjml-shell .gjs-trt-trait,
          .mjml-shell .gjs-trt-trait__label,
          .mjml-shell .gjs-label,
          .mjml-shell .gjs-field,
          .mjml-shell .gjs-field input,
          .mjml-shell .gjs-field select,
          .mjml-shell .gjs-field textarea,
          .mjml-shell .gjs-layer,
          .mjml-shell .gjs-layer-title,
          .mjml-shell .gjs-layer-name {
            color: #111827 !important;
          }

          .mjml-shell .gjs-field input,
          .mjml-shell .gjs-field select,
          .mjml-shell .gjs-field textarea {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-text-fill-color: #111827 !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-field input::placeholder,
          .mjml-shell .gjs-field textarea::placeholder {
            color: #374151 !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-field input:disabled,
          .mjml-shell .gjs-field select:disabled,
          .mjml-shell .gjs-field textarea:disabled,
          .mjml-shell .gjs-field input[readonly],
          .mjml-shell .gjs-field textarea[readonly] {
            color: #111827 !important;
            -webkit-text-fill-color: #111827 !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-one-bg,
          .mjml-shell .gjs-two-color,
          .mjml-shell .gjs-three-bg,
          .mjml-shell .gjs-four-color {
            background: transparent !important;
            color: inherit !important;
          }

          .mjml-shell .gjs-sm-properties,
          .mjml-shell .gjs-traits-c,
          .mjml-shell .gjs-layers {
            background: #f3f6f8 !important;
          }

          .mjml-shell .gjs-mdl-container {
            background: rgb(15 23 42 / 0.18) !important;
          }

          .mjml-shell .gjs-mdl-dialog,
          .mjml-shell .gjs-am-assets-cont,
          .mjml-shell .gjs-am-file-uploader,
          .mjml-shell .gjs-am-assets {
            background: #ffffff !important;
            color: #111827 !important;
          }

          .mjml-shell .gjs-am-add-asset input,
          .mjml-shell .gjs-am-add-asset button,
          .mjml-shell .gjs-am-file-uploader {
            color: #111827 !important;
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
            opacity: 1 !important;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mjml-editor-theme space-y-3">
      {showHelpText ? (
        <div className="rounded-md border border-slate-300 bg-slate-100 p-3 text-xs text-slate-700">
          Professional drag-and-drop mode: left blocks, center canvas, right style panel. Saved
          template keeps both compiled HTML and source MJML.
        </div>
      ) : null}
      <div className="min-h-[720px] overflow-hidden rounded-md border border-slate-300 bg-slate-50">
        <div ref={containerRef} />
      </div>
      <style jsx global>{`
        .mjml-editor-theme .gjs-one-bg {
          background-color: #f8fafc;
        }

        .mjml-editor-theme .gjs-two-color {
          color: #334155;
        }

        .mjml-editor-theme .gjs-three-bg {
          background-color: #0f766e;
          color: #ffffff;
        }

        .mjml-editor-theme .gjs-four-color,
        .mjml-editor-theme .gjs-four-color-h:hover {
          color: #0f766e;
        }

        .mjml-editor-theme .gjs-pn-panel {
          border-color: #cbd5e1;
        }

        .mjml-editor-theme .gjs-block {
          border-color: #cbd5e1;
          background: #ffffff;
        }

        .mjml-editor-theme .gjs-mdl-dialog {
          background: #ffffff;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
