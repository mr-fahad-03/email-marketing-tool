'use client';

import { Eye, Redo2, Undo2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import 'grapesjs/dist/css/grapes.min.css';
import { TemplateImagePickerDialog } from '@/components/templates/template-image-picker-dialog';
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
  previewHeaderActions?: ReactNode;
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
  AssetManager?: {
    add?: (asset: string | { src: string }) => unknown;
    close?: () => void;
  };
  Modal?: {
    close?: () => void;
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
  parent?: () => GrapesComponentModel | null;
  getStyle: () => Record<string, string>;
  setStyle: (style: Record<string, string>) => void;
  getAttributes: () => Record<string, string>;
  setAttributes: (attrs: Record<string, string>) => void;
  components?: (components?: unknown, opts?: unknown) => unknown;
  find?: (query: string) => unknown[];
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
type ImagePickerMode = 'image' | 'section-background';

const DEFAULT_LINK_TARGET = '_self';
const SECTION_LINK_HREF_ATTR = 'data-section-link-href';
const SECTION_LINK_TARGET_ATTR = 'data-section-link-target';
const INHERITED_SECTION_LINK_ATTR = 'data-inherited-section-link';

const SECTION_CONTAINER_TYPES = new Set(['mj-section', 'mj-wrapper', 'mj-column', 'mj-hero']);
const BACKGROUND_CAPABLE_TYPES = new Set([
  'mj-section',
  'mj-wrapper',
  'mj-column',
  'mj-hero',
  'mj-body',
]);
const HREF_ATTRIBUTE_TYPES = new Set(['mj-image', 'mj-button', 'mj-navbar-link', 'mj-social-element']);
const SECTION_LINK_CHILD_TYPES = new Set(['mj-text', 'mj-image', 'mj-button', 'mj-navbar-link', 'mj-social-element']);

function isSectionContainerType(type: string): boolean {
  return SECTION_CONTAINER_TYPES.has(type);
}

function isBackgroundCapableType(type: string): boolean {
  return BACKGROUND_CAPABLE_TYPES.has(type);
}

function supportsHrefAttribute(type: string): boolean {
  return HREF_ATTRIBUTE_TYPES.has(type);
}

function shouldReceiveSectionLink(type: string): boolean {
  return SECTION_LINK_CHILD_TYPES.has(type);
}

function normalizeLinkInput(input: string): string {
  const raw = input.trim().replace(/\s+/g, '');
  if (!raw) {
    return '';
  }

  if (
    raw.startsWith('#') ||
    /^https?:\/\//i.test(raw) ||
    /^mailto:/i.test(raw) ||
    /^tel:/i.test(raw) ||
    /^sms:/i.test(raw) ||
    /^ftp:\/\//i.test(raw)
  ) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (/^[a-z][a-z0-9+\-.]*:/i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function normalizeLinkTarget(input: string | null | undefined): string {
  const target = (input ?? '').trim();
  return target || DEFAULT_LINK_TARGET;
}

function collectionToComponents(collection: unknown): GrapesComponentModel[] {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection as GrapesComponentModel[];
  }

  if (
    typeof collection === 'object' &&
    collection !== null &&
    'models' in collection &&
    Array.isArray((collection as { models?: unknown[] }).models)
  ) {
    return (collection as { models: GrapesComponentModel[] }).models;
  }

  if (typeof (collection as { forEach?: unknown }).forEach === 'function') {
    const list: GrapesComponentModel[] = [];
    (collection as { forEach: (callback: (item: unknown) => void) => void }).forEach((item) => {
      list.push(item as GrapesComponentModel);
    });
    return list;
  }

  return [];
}

function getDescendantComponents(component: GrapesComponentModel): GrapesComponentModel[] {
  const children = collectionToComponents(
    component.components?.() ?? component.get?.('components') ?? null,
  );
  const descendants: GrapesComponentModel[] = [];

  for (const child of children) {
    descendants.push(child);
    descendants.push(...getDescendantComponents(child));
  }

  return descendants;
}

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

  const childComponents = collectionToComponents(
    component.components?.() ?? component.get?.('components') ?? null,
  );
  if (childComponents.length) {
    const childHtml = childComponents
      .map((child) => child.toHTML?.() ?? String(child.get?.('content') ?? ''))
      .join('')
      .trim();
    if (childHtml) {
      return extractInnerTextHtmlCandidate(childHtml);
    }
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

function setComponentHtmlContent(component: GrapesComponentModel | null, html: string): void {
  if (!component) {
    return;
  }

  try {
    component.components?.(html);
    component.set('content', '');
  } catch {
    try {
      component.set('content', html);
    } catch {
      // No-op: detached component views can throw during rapid edits.
    }
  }
}

function areEquivalentLinks(
  first: { href: string; target: string },
  second: { href: string; target: string },
): boolean {
  return normalizeLinkInput(first.href) === normalizeLinkInput(second.href) &&
    normalizeLinkTarget(first.target) === normalizeLinkTarget(second.target);
}

function getTextLinkFromAnchor(component: GrapesComponentModel): { href: string; target: string } {
  const anchor = extractWrapperAnchorDetails(getComponentEditableContent(component));
  return {
    href: normalizeLinkInput(anchor?.href ?? ''),
    target: normalizeLinkTarget(anchor?.target),
  };
}

function setTextLinkDataAttributes(
  component: GrapesComponentModel | null,
  next: { href: string; target: string },
): void {
  if (!component) {
    return;
  }

  const nextHref = normalizeLinkInput(next.href);
  const nextTarget = normalizeLinkTarget(next.target);

  const attrs = component.getAttributes?.() ?? {};
  const updatedAttrs = {
    ...attrs,
    'data-text-link-href': nextHref,
    'data-text-link-target': nextTarget,
  };

  try {
    component.setAttributes(updatedAttrs);
  } catch {
    // No-op: detached component views can throw during rapid edits.
  }
}

function getTextLinkStateFromComponent(
  component: GrapesComponentModel | null,
): { href: string; target: string } {
  if (!component || String(component.get('type') ?? '') !== 'mj-text') {
    return { href: '', target: DEFAULT_LINK_TARGET };
  }

  const attrs = component.getAttributes?.() ?? {};
  const hrefFromAttrs = normalizeLinkInput(attrs['data-text-link-href'] ?? '');
  const targetFromAttrs = normalizeLinkTarget(attrs['data-text-link-target']);
  if (hrefFromAttrs) {
    return {
      href: hrefFromAttrs,
      target: targetFromAttrs,
    };
  }

  return getTextLinkFromAnchor(component);
}

function applyTextLinkToComponent(
  component: GrapesComponentModel | null,
  input: { href: string; target?: string },
  options?: { sourceHtml?: string },
): void {
  if (!component) {
    return;
  }

  const href = normalizeLinkInput(input.href);
  const target = normalizeLinkTarget(input.target);
  const currentContent = (options?.sourceHtml ?? getComponentEditableContent(component)).trim();
  const cleanContent = stripAllAnchors(stripSingleWrapperAnchor(currentContent));
  const fallbackText = component.getEl?.()?.textContent?.trim() ?? '';
  const linkableContent = cleanContent.trim() ? cleanContent : plainTextToHtml(fallbackText);

  if (!href) {
    if (cleanContent !== currentContent) {
      setComponentHtmlContent(component, cleanContent);
    }
    try {
      const attrsWithoutLink = { ...(component.getAttributes?.() ?? {}) };
      delete attrsWithoutLink['data-text-link-href'];
      delete attrsWithoutLink['data-text-link-target'];
      component.setAttributes(attrsWithoutLink);
    } catch {
      // No-op: detached component views can throw during rapid edits.
    }
    return;
  }

  // Never overwrite content with an empty anchor.
  if (!linkableContent.trim()) {
    return;
  }

  const wrappedBlockMatch = linkableContent.match(/^<(div|p|span)\b([^>]*)>([\s\S]*)<\/\1>$/i);
  const anchorStyle = 'color:inherit;text-decoration:none;';
  const linkedContent = wrappedBlockMatch
    ? `<${wrappedBlockMatch[1]}${wrappedBlockMatch[2]}><a href="${escapeHtmlAttr(href)}" target="${escapeHtmlAttr(target)}" style="${anchorStyle}">${wrappedBlockMatch[3]}</a></${wrappedBlockMatch[1]}>`
    : `<a href="${escapeHtmlAttr(href)}" target="${escapeHtmlAttr(target)}" style="${anchorStyle}">${linkableContent}</a>`;
  if (linkedContent !== currentContent) {
    setComponentHtmlContent(component, linkedContent);
  }

  setTextLinkDataAttributes(component, { href, target });
}

function migrateLegacyTextLinkAttributes(component: GrapesComponentModel): void {
  if (String(component.get('type') ?? '') !== 'mj-text') {
    return;
  }

  const attrs = component.getAttributes?.() ?? {};
  const legacyHref = normalizeLinkInput(attrs['data-text-link-href'] ?? '');
  if (!legacyHref) {
    return;
  }

  const legacyTarget = normalizeLinkTarget(attrs['data-text-link-target']);
  const anchorLink = getTextLinkFromAnchor(component);
  if (areEquivalentLinks(anchorLink, { href: legacyHref, target: legacyTarget })) {
    return;
  }

  applyTextLinkToComponent(component, {
    href: legacyHref,
    target: legacyTarget,
  });
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

function getAssetUrlFromElement(assetEl: Element): string {
  const imageEl = assetEl.querySelector('img');
  const imageSrc = imageEl?.getAttribute('src')?.trim();
  if (imageSrc) {
    return imageSrc;
  }

  const dataSrc =
    assetEl.getAttribute('data-src')?.trim() ||
    assetEl.querySelector('[data-src]')?.getAttribute('data-src')?.trim();
  if (dataSrc) {
    return dataSrc;
  }

  const previewEl = assetEl.querySelector('.gjs-am-preview') as HTMLElement | null;
  const backgroundImage =
    previewEl?.style.backgroundImage ||
    (previewEl ? window.getComputedStyle(previewEl).backgroundImage : '');
  return fromCssUrl(backgroundImage).trim();
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

function buildPreviewSrcDoc(source: string | null | undefined): string {
  const content = (source ?? '').trim();
  const injection =
    '<base target="_blank"><script>document.addEventListener("click",function(event){const anchor=event.target.closest&&event.target.closest("a");if(anchor&&anchor.href){window.open(anchor.href,"_blank");event.preventDefault();}},true);</script>';

  if (!content) {
    return `<!doctype html><html><head>${injection}</head><body></body></html>`;
  }

  if (/<html[\s>]/i.test(content)) {
    if (/<head[\s>]/i.test(content)) {
      return content.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
    }
    return content.replace(/<html([^>]*)>/i, `<html$1><head>${injection}</head>`);
  }

  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return `<!doctype html><html><head>${injection}</head><body>${bodyMatch[1]}</body></html>`;
  }

  return `<!doctype html><html><head>${injection}</head><body>${content}</body></html>`;
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
  previewHeaderActions,
  fullHeight = false,
  showHelpText = true,
  previewBlocked = false,
  onPreviewBlocked,
}: LayoutTemplateEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<GrapesEditorInstance | null>(null);
  const selectedComponentRef = useRef<GrapesComponentModel | null>(null);
  const sectionBackgroundTargetRef = useRef<GrapesComponentModel | null>(null);
  const applyImageManagerSelectionRef = useRef<(imageUrl: string) => void>(() => {});
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
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<GrapesComponentModel | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imagePickerMode, setImagePickerMode] = useState<ImagePickerMode>('image');
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

  const patchComponentAttributes = (
    component: GrapesComponentModel | null,
    updates: Record<string, string>,
    removeKeys: string[] = [],
  ) => {
    if (!component) {
      return;
    }

    const attrs = component.getAttributes?.() ?? {};
    const nextAttrs: Record<string, string> = {
      ...attrs,
      ...updates,
    };

    for (const key of removeKeys) {
      delete nextAttrs[key];
    }

    try {
      component.setAttributes(nextAttrs);
    } catch {
      // No-op: component may be detached while editing quickly.
    }
  };

  const updateSelectedAttributes = (updates: Record<string, string>, removeKeys: string[] = []) => {
    patchComponentAttributes(selectedComponent, updates, removeKeys);
  };

  const updateSelectedLinkAttribute = (
    key: 'href' | 'target',
    value: string,
    component: GrapesComponentModel | null = selectedComponent,
  ) => {
    if (!component) {
      return;
    }

    const nextValue = key === 'href' ? normalizeLinkInput(value) : value.trim();

    patchComponentAttributes(component, { [key]: nextValue }, [INHERITED_SECTION_LINK_ATTR]);
  };

  const applyHrefToComponent = (
    component: GrapesComponentModel,
    input: { href: string; target?: string },
    inherited: boolean,
  ) => {
    const type = String(component.get('type') ?? '');
    const href = normalizeLinkInput(input.href);
    const target = normalizeLinkTarget(input.target);
    const attrs = component.getAttributes?.() ?? {};

    if (type === 'mj-text') {
      applyTextLinkToComponent(component, { href, target });
      patchComponentAttributes(
        component,
        inherited ? { [INHERITED_SECTION_LINK_ATTR]: 'true' } : {},
        inherited ? [] : [INHERITED_SECTION_LINK_ATTR],
      );
      return;
    }

    if (!supportsHrefAttribute(type)) {
      return;
    }

    const resolvedTarget = inherited ? target : attrs.target?.trim() || target;

    patchComponentAttributes(
      component,
      {
        href,
        target: resolvedTarget,
        ...(inherited ? { [INHERITED_SECTION_LINK_ATTR]: 'true' } : {}),
      },
      inherited ? [] : [INHERITED_SECTION_LINK_ATTR],
    );
  };

  const removeHrefFromComponent = (component: GrapesComponentModel) => {
    const type = String(component.get('type') ?? '');
    if (type === 'mj-text') {
      applyTextLinkToComponent(component, { href: '', target: DEFAULT_LINK_TARGET });
      patchComponentAttributes(component, {}, [INHERITED_SECTION_LINK_ATTR]);
      return;
    }

    if (!supportsHrefAttribute(type)) {
      patchComponentAttributes(component, {}, [INHERITED_SECTION_LINK_ATTR]);
      return;
    }

    patchComponentAttributes(component, {}, ['href', 'target', INHERITED_SECTION_LINK_ATTR]);
  };

  const componentHasExplicitLink = (component: GrapesComponentModel): boolean => {
    const type = String(component.get('type') ?? '');
    const attrs = component.getAttributes?.() ?? {};
    if (type === 'mj-text') {
      const attrLink = normalizeLinkInput(attrs['data-text-link-href'] ?? '');
      if (attrLink) {
        return true;
      }
      return Boolean(extractWrapperAnchorDetails(getComponentEditableContent(component))?.href);
    }

    if (!supportsHrefAttribute(type)) {
      return false;
    }

    return Boolean(attrs.href?.trim());
  };

  const applySectionLinkToComponent = (
    component: GrapesComponentModel,
    input: { href: string; target?: string },
  ) => {
    const sectionHref = normalizeLinkInput(input.href);
    const sectionTarget = normalizeLinkTarget(input.target);

    patchComponentAttributes(
      component,
      sectionHref
        ? {
            [SECTION_LINK_HREF_ATTR]: sectionHref,
            [SECTION_LINK_TARGET_ATTR]: sectionTarget,
          }
        : {},
      sectionHref ? [] : [SECTION_LINK_HREF_ATTR, SECTION_LINK_TARGET_ATTR],
    );

    const descendants = getDescendantComponents(component);
    for (const child of descendants) {
      const childType = String(child.get('type') ?? '');
      if (!shouldReceiveSectionLink(childType)) {
        continue;
      }

      const childAttrs = child.getAttributes?.() ?? {};
      const inherited = childAttrs[INHERITED_SECTION_LINK_ATTR] === 'true';

      if (!sectionHref) {
        if (inherited) {
          removeHrefFromComponent(child);
        }
        continue;
      }

      if (inherited || !componentHasExplicitLink(child)) {
        applyHrefToComponent(
          child,
          {
            href: sectionHref,
            target: sectionTarget,
          },
          true,
        );
      }
    }
  };

  const applyImageManagerSelection = (imageUrl: string) => {
    const editor = editorRef.current;
    const component =
      (editor?.getSelected?.() as GrapesComponentModel | null) ?? selectedComponentRef.current;

    editor?.AssetManager?.add?.({ src: imageUrl });

    if (imagePickerMode === 'section-background') {
      const sectionComponent = sectionBackgroundTargetRef.current ?? component;
      if (sectionComponent) {
        patchComponentAttributes(sectionComponent, {
          'background-url': imageUrl,
        });
        editor?.select?.(sectionComponent);
        setSelectedComponent(sectionComponent);
        bumpSelectedComponent();
        keepComponentSelected(sectionComponent);
      }
      sectionBackgroundTargetRef.current = null;
      setImagePickerMode('image');
    } else if (component && String(component.get?.('type') ?? '') === 'mj-image') {
      patchComponentAttributes(component, {
        src: imageUrl,
      });
      editor?.select?.(component);
      setSelectedComponent(component);
      bumpSelectedComponent();
      keepComponentSelected(component);
    }

    editor?.AssetManager?.close?.();
    editor?.Modal?.close?.();
    setIsImagePickerOpen(false);
    setTimeout(() => refreshCanvasRef.current?.(), 0);
  };
  applyImageManagerSelectionRef.current = applyImageManagerSelection;

  const updateSelectedStyle = (updates: Record<string, string>) => {
    if (!selectedComponent) {
      return;
    }
    const current = selectedComponent.getStyle?.() ?? {};
    try {
      selectedComponent.setStyle({
        ...current,
        ...updates,
      });
    } catch {
      // No-op: component may be detached while editing quickly.
    }
  };

  const openSectionBackgroundImagePicker = () => {
    if (!selectedComponent) {
      return;
    }
    sectionBackgroundTargetRef.current = selectedComponent;
    setImagePickerMode('section-background');
    setIsImagePickerOpen(true);
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
            { id: DEFAULT_LINK_TARGET, label: 'Same tab' },
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
            { id: DEFAULT_LINK_TARGET, label: 'Same tab' },
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
            { id: DEFAULT_LINK_TARGET, label: 'Same tab' },
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
    onMjmlChangeRef.current = onMjmlChange;
  }, [onMjmlChange]);

  useEffect(() => {
    if (designJson && onDesignChange) {
      onDesignChange(designJson);
    }
  }, [designJson, onDesignChange]);

  useEffect(() => {
    let disposed = false;
    let assetModalObserver: MutationObserver | null = null;

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

        if (frameDoc && !frameDoc.documentElement.dataset.mjmlLinkClickHandlerAttached) {
          frameDoc.documentElement.dataset.mjmlLinkClickHandlerAttached = 'true';
          frameDoc.addEventListener(
            'click',
            (event) => {
              const anchor = (event.target as Element | null)?.closest('a');
              if (!anchor || !anchor.href) {
                return;
              }

              const href = anchor.getAttribute('href')?.trim();
              if (!href) {
                return;
              }

              const parentWindow = frameDoc.defaultView?.parent;
              parentWindow?.open(href, '_blank');
              event.preventDefault();
              event.stopPropagation();
            },
            true,
          );
        }
      };

      refreshCanvasRef.current = ensureCanvasScroll;

      const injectImageManagerButton = () => {
        const root = containerRef.current?.ownerDocument ?? document;
        const uploader = root.querySelector('.gjs-am-file-uploader');
        if (uploader && !uploader.querySelector('[data-template-image-manager-button="true"]')) {
          const button = root.createElement('button');
          button.type = 'button';
          button.dataset.templateImageManagerButton = 'true';
          button.className = 'gjs-template-image-manager-button';
          button.textContent = 'Image Manager';
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            editor.AssetManager?.close?.();
            editor.Modal?.close?.();
            setImagePickerMode('image');
            sectionBackgroundTargetRef.current = null;
            setIsImagePickerOpen(true);
          });

          uploader.insertBefore(button, uploader.firstChild);
        }

        const assetsList = root.querySelector('.gjs-am-assets') as HTMLElement | null;
        if (
          assetsList &&
          assetsList.dataset.templateAssetClickApply !== 'true'
        ) {
          assetsList.dataset.templateAssetClickApply = 'true';
          assetsList.addEventListener('click', (event) => {
            const target = event.target as Element | null;
            const assetEl = target?.closest('.gjs-am-asset');
            if (!assetEl) {
              return;
            }

            const assetUrl = getAssetUrlFromElement(assetEl);
            if (!assetUrl) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            applyImageManagerSelectionRef.current(assetUrl);
          });
        }
      };

      assetModalObserver = new MutationObserver(() => injectImageManagerButton());
      assetModalObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      editor.on('load', ensureCanvasScroll);
      editor.on('load', injectImageManagerButton);
      editor.on('modal:open', injectImageManagerButton);
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
      editor.on('component:add', (component) => {
        const child = component as GrapesComponentModel;
        const childType = String(child.get('type') ?? '');
        if (!shouldReceiveSectionLink(childType)) {
          return;
        }

        if (componentHasExplicitLink(child)) {
          return;
        }

        let parent = child.parent?.() ?? null;
        while (parent) {
          const parentType = String(parent.get('type') ?? '');
          if (!isSectionContainerType(parentType)) {
            parent = parent.parent?.() ?? null;
            continue;
          }

          const parentAttrs = parent.getAttributes?.() ?? {};
          const inheritedHref = normalizeLinkInput(parentAttrs[SECTION_LINK_HREF_ATTR] ?? '');
          if (!inheritedHref) {
            parent = parent.parent?.() ?? null;
            continue;
          }

          const inheritedTarget = normalizeLinkTarget(parentAttrs[SECTION_LINK_TARGET_ATTR]);
          if (childType === 'mj-text') {
            applyTextLinkToComponent(child, {
              href: inheritedHref,
              target: inheritedTarget,
            });
            patchComponentAttributes(child, { [INHERITED_SECTION_LINK_ATTR]: 'true' });
          } else if (supportsHrefAttribute(childType)) {
            patchComponentAttributes(child, {
              href: inheritedHref,
              target: inheritedTarget,
              [INHERITED_SECTION_LINK_ATTR]: 'true',
            });
          }
          break;
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
      assetModalObserver?.disconnect();
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
    if (previewMode) {
      return;
    }

    const timer = window.setTimeout(() => {
      refreshCanvasRef.current?.();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [previewMode]);

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
  const isSectionContainerComponent = isSectionContainerType(selectedType);
  const isBackgroundCapableComponent = isBackgroundCapableType(selectedType);
  const selectedImageSrc = selectedAttributes.src ?? '';
  const selectedImageAlt = selectedAttributes.alt ?? '';
  const selectedImageTitle = selectedAttributes.title ?? '';
  const selectedImageHref = selectedAttributes.href ?? '';
  const selectedImageTarget = normalizeLinkTarget(selectedAttributes.target);
  const selectedImageMaxWidth = selectedAttributes.width ?? selectedStyles.width ?? '';
  const selectedImageAlign = selectedAttributes.align ?? selectedStyles['text-align'] ?? 'center';
  const selectedHoverImage = selectedAttributes['data-hover-src'] ?? '';
  const selectedBackgroundColor =
    selectedAttributes['background-color'] ?? selectedStyles['background-color'] ?? '';
  const selectedBackgroundImage =
    selectedAttributes['background-url'] ?? fromCssUrl(selectedStyles['background-image'] ?? '');
  const selectedPaddingTop =
    selectedAttributes['padding-top'] ?? selectedStyles['padding-top'] ?? '';
  const selectedPaddingRight =
    selectedAttributes['padding-right'] ?? selectedStyles['padding-right'] ?? '';
  const selectedPaddingBottom =
    selectedAttributes['padding-bottom'] ?? selectedStyles['padding-bottom'] ?? '';
  const selectedPaddingLeft =
    selectedAttributes['padding-left'] ?? selectedStyles['padding-left'] ?? '';
  const selectedHeight = selectedAttributes.height ?? selectedStyles.height ?? '';
  const selectedBorderRadius =
    selectedAttributes['border-radius'] ?? selectedStyles['border-radius'] ?? '';
  const selectedBorder = selectedAttributes.border ?? selectedStyles.border ?? '';
  const selectedSectionAlign = selectedAttributes['text-align'] ?? selectedStyles['text-align'] ?? 'center';
  const selectedTextColor = selectedAttributes.color ?? selectedStyles.color ?? '';
  const selectedTextFontSize = selectedAttributes['font-size'] ?? selectedStyles['font-size'] ?? '';
  const selectedFontFamily = selectedAttributes['font-family'] ?? selectedStyles['font-family'] ?? '';
  const selectedLineHeight = selectedAttributes['line-height'] ?? selectedStyles['line-height'] ?? '';
  const selectedTextAlign = selectedAttributes.align ?? selectedStyles['text-align'] ?? 'left';
  const selectedButtonText = selectedTextContent;
  const selectedButtonHref = selectedAttributes.href ?? '';
  const selectedButtonTarget = normalizeLinkTarget(selectedAttributes.target);
  const selectedButtonTitle = selectedAttributes.title ?? '';
  const selectedButtonAlign = selectedAttributes.align ?? selectedStyles['text-align'] ?? 'center';
  const selectedButtonBackgroundColor =
    selectedAttributes['background-color'] ?? selectedStyles['background-color'] ?? '';
  const selectedButtonTextColor = selectedAttributes.color ?? selectedStyles.color ?? '';
  const selectedButtonWidth = selectedAttributes.width ?? selectedStyles.width ?? '';
  const selectedGenericHref = selectedAttributes.href ?? '';
  const selectedGenericTarget = normalizeLinkTarget(selectedAttributes.target);
  const selectedSectionLink = selectedAttributes[SECTION_LINK_HREF_ATTR] ?? '';
  const selectedSectionLinkTarget = normalizeLinkTarget(selectedAttributes[SECTION_LINK_TARGET_ATTR]);

  const isTextComponent = selectedType === 'mj-text';
  const isImageComponent = selectedType === 'mj-image';
  const isButtonComponent = selectedType === 'mj-button';
  const selectedTextLinkState = isTextComponent
    ? getTextLinkStateFromComponent(selectedComponent)
    : { href: '', target: DEFAULT_LINK_TARGET };
  const selectedTextLink = selectedTextLinkState.href;
  const selectedTextLinkTarget = selectedTextLinkState.target;
  const isTextLinkEnabled = Boolean(selectedTextLink.trim());
  const isSectionLinkEnabled = Boolean(selectedSectionLink.trim());
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
            {previewMode ? (
              previewHeaderActions ? <div className="mr-2 flex items-center gap-2">{previewHeaderActions}</div> : null
            ) : (
              <>
                {headerActions ? <div className="mr-2 flex items-center gap-2">{headerActions}</div> : null}
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
              </>
            )}
            <button
              type="button"
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold',
                previewMode
                  ? 'border-[#99d9f0] bg-[#cfeef9] text-[#0a4f68]'
                  : 'border-[#1d718d] bg-[#0f5b76] text-white hover:bg-[#0c6784]',
              )}
              onClick={runPreviewToggle}
            >
              <Eye className="h-3.5 w-3.5" />
              {previewMode ? 'Back to editor' : 'Preview'}
            </button>
          </div>
        </div>

        {previewMode ? (
          <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#dfe3e7] p-4">
            <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[1.4fr_0.7fr]">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">
                <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Desktop preview</div>
                <iframe
                  className="h-full w-full border-0"
                  srcDoc={buildPreviewSrcDoc(value)}
                  title="Desktop preview"
                />
              </div>
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white">
                <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700">Mobile preview</div>
                <div className="flex h-full min-h-0 items-center justify-center bg-slate-100 p-3">
                  <iframe
                    className="h-full w-full max-w-[375px] border border-slate-200"
                    srcDoc={buildPreviewSrcDoc(value)}
                    title="Mobile preview"
                  />
                </div>
              </div>
            </div>
          </main>
        ) : null}
        <div
          className={cn(
            'grid h-full min-h-0 flex-1 grid-cols-[108px_minmax(0,1fr)_320px] overflow-hidden',
            previewMode && 'hidden',
          )}
        >
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
                              setComponentHtmlContent(selectedComponent, nextTextHtml);
                              const currentTextLinkState = getTextLinkStateFromComponent(selectedComponent);
                              if (!currentTextLinkState.href) {
                                patchComponentAttributes(selectedComponent, {}, [
                                  'data-text-link-href',
                                  'data-text-link-target',
                                ]);
                              } else {
                                applyTextLinkToComponent(selectedComponent, {
                                  href: currentTextLinkState.href,
                                  target: currentTextLinkState.target,
                                }, { sourceHtml: nextTextHtml });
                              }
                              keepComponentSelected(selectedComponent);
                              refreshCanvasRef.current?.();
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Text color</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextColor}
                            onChange={(event) => updateSelectedAttributes({ color: event.target.value.trim() })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Text size</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextFontSize}
                            placeholder="14px"
                            onChange={(event) =>
                              updateSelectedAttributes({
                                'font-size': event.target.value.trim() ? pxValue(event.target.value) : '',
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Font</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedFontFamily}
                            onChange={(event) =>
                              updateSelectedAttributes({ 'font-family': event.target.value })
                            }
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
                              updateSelectedAttributes({
                                'line-height': event.target.value.trim() ? pxValue(event.target.value) : '',
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Alignment</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextAlign}
                            onChange={(event) => updateSelectedAttributes({ align: event.target.value })}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={isTextLinkEnabled}
                              onChange={(event) => {
                                if (!selectedComponent) {
                                  return;
                                }
                                const currentTextLinkState = getTextLinkStateFromComponent(selectedComponent);
                                if (!event.target.checked) {
                                  applyTextLinkToComponent(selectedComponent, {
                                    href: '',
                                    target: currentTextLinkState.target,
                                  });
                                } else {
                                  applyTextLinkToComponent(selectedComponent, {
                                    href: currentTextLinkState.href || 'https://example.com',
                                    target: currentTextLinkState.target,
                                  });
                                }
                                patchComponentAttributes(selectedComponent, {}, [INHERITED_SECTION_LINK_ATTR]);
                                keepComponentSelected(selectedComponent);
                              }}
                            />
                            Add a link
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextLink}
                            placeholder="https://example.com"
                            onChange={(event) => {
                              if (!selectedComponent) {
                                return;
                              }
                              const currentTextLinkState = getTextLinkStateFromComponent(selectedComponent);
                              applyTextLinkToComponent(selectedComponent, {
                                href: event.target.value,
                                target: currentTextLinkState.target,
                              });
                              patchComponentAttributes(selectedComponent, {}, [INHERITED_SECTION_LINK_ATTR]);
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedTextLinkTarget}
                            onChange={(event) => {
                              if (!selectedComponent) {
                                return;
                              }
                              const currentTextLinkState = getTextLinkStateFromComponent(selectedComponent);
                              if (!currentTextLinkState.href) {
                                return;
                              }
                              applyTextLinkToComponent(selectedComponent, {
                                href: currentTextLinkState.href,
                                target: event.target.value,
                              });
                              patchComponentAttributes(selectedComponent, {}, [INHERITED_SECTION_LINK_ATTR]);
                              keepComponentSelected(selectedComponent);
                            }}
                          >
                            <option value={DEFAULT_LINK_TARGET}>Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </div>
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
                                  href: event.target.checked
                                    ? normalizeLinkInput(selectedImageHref || 'https://example.com')
                                    : '',
                                }, [INHERITED_SECTION_LINK_ATTR])
                              }
                            />
                            Add a link
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageHref}
                            placeholder="https://example.com"
                            onChange={(event) => updateSelectedLinkAttribute('href', event.target.value)}
                          />
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedImageTarget}
                            onChange={(event) => updateSelectedLinkAttribute('target', event.target.value)}
                          >
                            <option value={DEFAULT_LINK_TARGET}>Same tab</option>
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
                              setComponentHtmlContent(selectedComponent, plainTextToHtml(event.target.value));
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Button color</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonBackgroundColor}
                            placeholder="#0f766e"
                            onChange={(event) =>
                              updateSelectedAttributes({ 'background-color': event.target.value.trim() })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Text color</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonTextColor}
                            placeholder="#ffffff"
                            onChange={(event) =>
                              updateSelectedAttributes({ color: event.target.value.trim() })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Button size</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonWidth}
                            placeholder="160px"
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
                            value={selectedButtonAlign}
                            onChange={(event) => updateSelectedAttributes({ align: event.target.value })}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Add a link</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonHref}
                            placeholder="https://example.com"
                            onChange={(event) => updateSelectedLinkAttribute('href', event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedButtonTarget}
                            onChange={(event) => updateSelectedLinkAttribute('target', event.target.value)}
                          >
                            <option value={DEFAULT_LINK_TARGET}>Same tab</option>
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
                            onChange={(event) => updateSelectedLinkAttribute('href', event.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedGenericTarget}
                            onChange={(event) => updateSelectedLinkAttribute('target', event.target.value)}
                          >
                            <option value={DEFAULT_LINK_TARGET}>Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    {isSectionContainerComponent ? (
                      <div className="space-y-3 border-t border-slate-200 pt-3">
                        <div className="text-xs font-semibold text-[#0b6886]">Section link</div>
                        <div className="space-y-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={isSectionLinkEnabled}
                              onChange={(event) => {
                                if (!selectedComponent) {
                                  return;
                                }
                                applySectionLinkToComponent(selectedComponent, {
                                  href: event.target.checked
                                    ? selectedSectionLink || 'https://example.com'
                                    : '',
                                  target: selectedSectionLinkTarget,
                                });
                                keepComponentSelected(selectedComponent);
                              }}
                            />
                            Add a link
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedSectionLink}
                            placeholder="https://example.com"
                            onChange={(event) => {
                              if (!selectedComponent) {
                                return;
                              }
                              applySectionLinkToComponent(selectedComponent, {
                                href: event.target.value,
                                target: selectedSectionLinkTarget,
                              });
                              keepComponentSelected(selectedComponent);
                            }}
                          />
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Link target</span>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedSectionLinkTarget}
                            onChange={(event) => {
                              if (!selectedComponent) {
                                return;
                              }
                              applySectionLinkToComponent(selectedComponent, {
                                href: selectedSectionLink,
                                target: event.target.value,
                              });
                              keepComponentSelected(selectedComponent);
                            }}
                          >
                            <option value={DEFAULT_LINK_TARGET}>Same tab</option>
                            <option value="_blank">New tab</option>
                          </select>
                        </div>
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
                            onChange={(event) => {
                              const nextValue = event.target.value.trim();
                              if (isBackgroundCapableComponent) {
                                updateSelectedAttributes({ 'background-color': nextValue });
                              } else {
                                updateSelectedStyle({ 'background-color': nextValue });
                              }
                            }}
                          />
                        </label>
                        <div className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Background image</span>
                          {isSectionContainerComponent ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                className="inline-flex h-9 w-full items-center justify-center rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
                                onClick={openSectionBackgroundImagePicker}
                              >
                                {selectedBackgroundImage ? 'Change background image' : 'Select background image'}
                              </button>
                              {selectedBackgroundImage ? (
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                                    {selectedBackgroundImage}
                                  </div>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center justify-center rounded border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    onClick={() => updateSelectedAttributes({ 'background-url': '' })}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <input
                              type="text"
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedBackgroundImage}
                              placeholder="https://example.com/bg.png"
                              onChange={(event) => {
                                const nextUrl = event.target.value.trim();
                                if (isBackgroundCapableComponent) {
                                  updateSelectedAttributes({ 'background-url': nextUrl });
                                } else {
                                  updateSelectedStyle({
                                    'background-image': nextUrl ? toCssUrl(nextUrl) : '',
                                  });
                                }
                              }}
                            />
                          )}
                        </div>
                        {isSectionContainerComponent ? (
                          <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-700">Alignment</span>
                            <select
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedSectionAlign}
                              onChange={(event) =>
                                updateSelectedAttributes({ 'text-align': event.target.value })
                              }
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </label>
                        ) : null}
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Inner Padding</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingTop}
                              placeholder="Top"
                              onChange={(event) =>
                                updateSelectedAttributes({ 'padding-top': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingBottom}
                              placeholder="Bottom"
                              onChange={(event) =>
                                updateSelectedAttributes({ 'padding-bottom': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingLeft}
                              placeholder="Left"
                              onChange={(event) =>
                                updateSelectedAttributes({ 'padding-left': pxValue(event.target.value) })
                              }
                            />
                            <input
                              type="text"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                              value={selectedPaddingRight}
                              placeholder="Right"
                              onChange={(event) =>
                                updateSelectedAttributes({ 'padding-right': pxValue(event.target.value) })
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
                            onChange={(event) =>
                              updateSelectedAttributes({ height: pxValue(event.target.value) })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">Round corners</span>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[#0b6886]"
                            value={selectedBorderRadius}
                            onChange={(event) =>
                              updateSelectedAttributes({ 'border-radius': pxValue(event.target.value) })
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
                            onChange={(event) => updateSelectedAttributes({ border: event.target.value.trim() })}
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
            background: rgb(15 23 42 / 0.32) !important;
          }

          .mjml-shell .gjs-mdl-dialog {
            width: min(850px, calc(100vw - 48px)) !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 10px !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: 0 24px 60px rgb(15 23 42 / 0.24) !important;
            overflow: hidden !important;
          }

          .mjml-shell .gjs-mdl-header {
            display: flex !important;
            align-items: center !important;
            min-height: 48px !important;
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 12px 16px !important;
            background: #ffffff !important;
          }

          .mjml-shell .gjs-mdl-title {
            color: #0f172a !important;
            font-size: 16px !important;
            font-weight: 700 !important;
          }

          .mjml-shell .gjs-mdl-btn-close {
            top: 10px !important;
            right: 14px !important;
            color: #94a3b8 !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-mdl-content {
            padding: 16px !important;
          }

          .mjml-shell .gjs-am-assets-cont,
          .mjml-shell .gjs-am-file-uploader,
          .mjml-shell .gjs-am-assets {
            background: #ffffff !important;
            color: #111827 !important;
          }

          .mjml-shell .gjs-am-add-asset {
            display: none !important;
          }

          .mjml-shell .gjs-am-file-uploader {
            width: 56% !important;
            padding-right: 16px !important;
          }

          .mjml-shell .gjs-am-file-uploader > form {
            min-height: 328px !important;
            border: 2px dashed #0f172a !important;
            border-radius: 8px !important;
            background: #f8fafc !important;
            color: #0f172a !important;
            overflow: hidden !important;
          }

          .mjml-shell .gjs-am-file-uploader #gjs-am-title {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100% !important;
            padding: 0 !important;
            color: #0f172a !important;
            font-size: 14px !important;
            font-weight: 500 !important;
          }

          .mjml-shell .gjs-am-file-uploader > form #gjs-am-uploadFile {
            min-height: 328px !important;
            padding: 0 !important;
            cursor: pointer !important;
          }

          .mjml-shell .gjs-am-assets-cont {
            width: 44% !important;
            height: 368px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            padding: 10px !important;
            overflow: hidden !important;
          }

          .mjml-shell .gjs-am-assets-header {
            padding: 0 0 8px !important;
            color: #475569 !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
          }

          .mjml-shell .gjs-am-assets {
            height: 318px !important;
            display: block !important;
            overflow-y: auto !important;
          }

          .mjml-shell .gjs-am-asset {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            width: 100% !important;
            margin: 0 0 8px !important;
            padding: 8px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease !important;
          }

          .mjml-shell .gjs-am-asset:hover {
            border-color: #0b6886 !important;
            box-shadow: 0 8px 20px rgb(15 23 42 / 0.12) !important;
            transform: translateY(-1px) !important;
          }

          .mjml-shell .gjs-am-preview-cont {
            width: 86px !important;
            height: 70px !important;
            flex: 0 0 86px !important;
            border-radius: 6px !important;
            background: #f1f5f9 !important;
          }

          .mjml-shell .gjs-am-meta {
            width: auto !important;
            min-width: 0 !important;
            padding: 0 !important;
            color: #0f172a !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            line-height: 1.35 !important;
          }

          .mjml-shell .gjs-am-meta > div {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            word-break: break-word !important;
          }

          .mjml-shell .gjs-am-add-asset input,
          .mjml-shell .gjs-am-add-asset button,
          .mjml-shell .gjs-am-file-uploader {
            color: #111827 !important;
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-template-image-manager-button {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 36px !important;
            margin: 0 0 12px !important;
            padding: 0 14px !important;
            border: 1px solid #0b6886 !important;
            border-radius: 6px !important;
            background: #0b6886 !important;
            color: #ffffff !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            opacity: 1 !important;
          }

          .mjml-shell .gjs-template-image-manager-button:hover {
            background: #07516a !important;
          }
        `}</style>

        <TemplateImagePickerDialog
          open={isImagePickerOpen}
          onOpenChange={(open) => {
            setIsImagePickerOpen(open);
            if (!open) {
              setImagePickerMode('image');
              sectionBackgroundTargetRef.current = null;
            }
          }}
          onSelectImage={(imageUrl) => applyImageManagerSelection(imageUrl)}
        />
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

      <TemplateImagePickerDialog
        open={isImagePickerOpen}
        onOpenChange={(open) => {
          setIsImagePickerOpen(open);
          if (!open) {
            setImagePickerMode('image');
            sectionBackgroundTargetRef.current = null;
          }
        }}
        onSelectImage={(imageUrl) => applyImageManagerSelection(imageUrl)}
      />
    </div>
  );
}
