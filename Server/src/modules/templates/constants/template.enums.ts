export enum TemplateChannelType {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export enum TemplateCategory {
  BUSINESS = 'business',
  ECOMMERCE = 'ecommerce',
  RESTAURANT = 'restaurant',
  OTHER = 'other',
  HOLIDAY = 'holiday',
  TRAVEL = 'travel',
  ONLINE_STORE = 'online-store',
  KITCHEN = 'kitchen',
  MEDICINE = 'medicine',
  EDUCATION = 'education',
  GENERAL = 'general',
  HOLIDAYS = 'holidays',
  TOURISM = 'tourism',
  MARKETING = 'marketing',
  TRANSACTIONAL = 'transactional',
  UTILITY = 'utility',
  AUTHENTICATION = 'authentication',
}

export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum TemplateEditorType {
  LAYOUT = 'layout',
  HTML = 'html',
}

export enum TemplateVisibility {
  PERSONAL = 'personal',
}

export enum TemplateLayoutPreset {
  EMPTY = 'empty',
  BASIC = 'basic',
  COMMERCE = 'commerce',
  THREE_COLUMNS = 'three-columns',
  NEWS = 'news',
  TEXT = 'text',
}

export const TEMPLATE_CHANNEL_VALUES = Object.values(TemplateChannelType);
export const TEMPLATE_CATEGORY_VALUES = Object.values(TemplateCategory);
export const TEMPLATE_STATUS_VALUES = Object.values(TemplateStatus);
export const TEMPLATE_EDITOR_VALUES = Object.values(TemplateEditorType);
export const TEMPLATE_VISIBILITY_VALUES = Object.values(TemplateVisibility);
export const TEMPLATE_LAYOUT_PRESET_VALUES = Object.values(TemplateLayoutPreset);
