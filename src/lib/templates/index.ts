import { SHARE_CERTIFICATE_TEMPLATE } from './share-certificate';
import { J30_FORM_TEMPLATE } from './j30-form';
import { OFFER_LETTER_TEMPLATE } from './offer-letter';

export interface TemplateField {
  key: string;
  label: string;
  required: boolean;
  default?: string;
}

export interface TemplateSigner {
  role: string;
  label: string;
  required: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  signers: TemplateSigner[];
  html: string;
}

const TEMPLATES: Record<string, DocumentTemplate> = {
  share_certificate: SHARE_CERTIFICATE_TEMPLATE,
  j30_form: J30_FORM_TEMPLATE,
  offer_letter: OFFER_LETTER_TEMPLATE,
};

export function getTemplate(id: string): DocumentTemplate | null {
  return TEMPLATES[id] || null;
}

export function listTemplates(): DocumentTemplate[] {
  return Object.values(TEMPLATES);
}

/**
 * Render a template with variable substitution.
 * Supports {{variable}}, {{#condition}}...{{/condition}}, {{^condition}}...{{/condition}}
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;

  // Handle simple variable substitution {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      const value = variables[key];
      if (value instanceof Date) {
        return value.toLocaleDateString('en-GB');
      }
      return String(value ?? '');
    }
    return match;
  });

  // Handle conditional sections {{#condition}}...{{/condition}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
    if (variables[key]) {
      return renderTemplate(content, variables);
    }
    return '';
  });

  // Handle negative conditionals {{^condition}}...{{/condition}}
  result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key, content) => {
    if (!variables[key]) {
      return renderTemplate(content, variables);
    }
    return '';
  });

  return result;
}

/**
 * Render a document from a template with variables filled in
 */
export function renderDocument(templateId: string, variables: Record<string, any>): string {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Apply defaults for missing fields
  const vars = { ...variables };
  for (const field of template.fields) {
    if (!(field.key in vars) && field.default) {
      vars[field.key] = field.default;
    }
  }

  return renderTemplate(template.html, vars);
}
