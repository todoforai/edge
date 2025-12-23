// Data types - what gets stored in ContextItem.data
//
// form  → FormData      {name: "Acme", website: "https://..."}
// list  → ListEntry[]   [{label: "Docs", url: "https://..."}, ...]
// list  → SecretEntry[] [{key: "API_KEY", value: "xxx", _masked: true}, ...]
// list  → FileEntry[]   [{name: "logo.png", url: "...", size: 1024, type: "image/png"}, ...]
// text  → TextData      "Any free-form text..."

export type FormData = Record<string, string>;
export type ListEntry = { [key: string]: string | boolean | undefined; _masked?: boolean };
export type SecretEntry = ListEntry;
export type FileEntry = { name: string; url: string; size?: number; type?: string };
export type FieldDef = { key: string; label: string; placeholder: string; hint?: string; secret?: boolean };
export type TextData = string;

export type DataType = FormData | ListEntry[] | SecretEntry[] | FileEntry[] | FieldDef[] | TextData;

// DB types (with timestamps, userId)
export type ContextItemDB = {
  id: string;
  template: string;
  label: string;
  icon: string;
  enabled: boolean;
  data: DataType;
  updatedAt: number;
};

export type BusinessDB = {
  id: string;
  userId: string;
  name: string;// TODO add business logo
  tagline: string;
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type BusinessFull = BusinessDB & {
  items: ContextItemDB[];
};

// Templates
export type DataTemplate = Omit<ContextItemDB, 'id' | 'enabled' | 'updatedAt'> & {
  description: string;
  multiple?: boolean; // can user add multiple of this template?
};

export const dataTemplates: Record<string, DataTemplate> = {
  company: {
    template: 'company',
    icon: 'mdi:domain',
    label: 'Company',
    description: 'Basic company info',
    data: [
      { key: 'name', label: 'Name', placeholder: 'Company name' },
      { key: 'website', label: 'Website', placeholder: 'https://...' },
      { key: 'location', label: 'Location', placeholder: 'City, Country', hint: 'Used for billing address auto-fill' },
      { key: 'team_size', label: 'Team Size', placeholder: 'Team size' },
      { key: 'vat', label: 'VAT', placeholder: 'VAT / Tax ID', hint: 'AI can fill billing forms with this' },
    ],
  },
  product: {
    template: 'product',
    icon: 'mdi:package-variant',
    label: 'Product',
    description: 'What you build',
    data: [
      { key: 'what', label: 'What', placeholder: 'What do you build?' },
      { key: 'who', label: 'Who', placeholder: 'Target customers' },
      { key: 'usp', label: 'USP', placeholder: 'Unique selling point' },
      { key: 'pricing', label: 'Pricing', placeholder: 'Pricing model' },
    ],
  },
  voice: {
    template: 'voice',
    icon: 'mdi:message-text',
    label: 'Voice & Tone',
    description: 'Communication style',
    data: [
      { key: 'tone', label: 'Tone', placeholder: 'Formal, casual, playful...' },
      { key: 'personality', label: 'Personality', placeholder: 'Brand personality traits' },
      { key: 'dos', label: 'Dos', placeholder: 'Writing dos' },
      { key: 'donts', label: "Don'ts", placeholder: "Writing don'ts" },
    ],
  },
  vision: {
    template: 'vision',
    icon: 'mdi:lightbulb',
    label: 'Vision',
    description: 'Mission & goals',
    data: [
      { key: 'mission', label: 'Mission', placeholder: 'Mission statement' },
      { key: 'values', label: 'Values', placeholder: 'Core values' },
      { key: 'goals', label: 'Goals', placeholder: 'Long-term goals' },
    ],
  },
  secrets: {
    template: 'secrets',
    icon: 'mdi:shield-key',
    label: 'Vault',
    description: 'API keys & secrets',
    data: [
      { key: 'key', label: 'Key', placeholder: 'API_KEY' },
      { key: 'value', label: 'Value', placeholder: 'secret value', secret: true },
    ],
    multiple: true,
  },
  links: {
    template: 'links',
    icon: 'mdi:link-variant',
    label: 'Links',
    description: 'Important URLs',
    data: [
      { key: 'label', label: 'Label', placeholder: 'Link name' },
      { key: 'url', label: 'URL', placeholder: 'https://...' },
    ],
    multiple: true,
  },
  files: {
    template: 'files',
    icon: 'mdi:paperclip',
    label: 'Attachments',
    description: 'Files & assets',
    data: [
      { key: 'name', label: 'Name', placeholder: 'File name' },
      { key: 'url', label: 'URL', placeholder: 'File URL' },
    ],
    multiple: true,
  },
  custom: {
    template: 'custom',
    icon: 'mdi:text-box',
    label: 'Custom',
    description: 'Free-form context',
    data: [],
    multiple: true,
  },
};

export const availableIcons = [
  'mdi:domain', 'mdi:package-variant', 'mdi:message-text', 'mdi:lightbulb',
  'mdi:shield-key', 'mdi:link-variant', 'mdi:paperclip', 'mdi:text-box',
  'mdi:rocket-launch', 'mdi:chart-line', 'mdi:account-group', 'mdi:cog',
  'mdi:palette', 'mdi:code-braces', 'mdi:database', 'mdi:cloud',
];

