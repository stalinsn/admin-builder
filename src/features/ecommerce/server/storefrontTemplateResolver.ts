import 'server-only';

import {
  type StorefrontTemplate,
  createDefaultStorefrontTemplate,
  normalizeStorefrontTemplate,
} from '@/features/site-runtime/storefrontTemplate';
import { readPublishedRuntimeStorefrontTemplate } from '@/features/site-runtime/server/publishedTemplateStore';

export function resolveStorefrontTemplate(): StorefrontTemplate {
  const snapshot = readPublishedRuntimeStorefrontTemplate();
  if (!snapshot?.template) {
    return createDefaultStorefrontTemplate();
  }

  return normalizeStorefrontTemplate(snapshot.template);
}
