const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

type SanitizeUrlOptions = {
  fallback?: string;
  allowRelative?: boolean;
  allowAnchor?: boolean;
  allowMailto?: boolean;
  allowTel?: boolean;
};

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_REGEX, '');
}

export function sanitizeSingleLineText(value: string | undefined | null, fallback = ''): string {
  if (!value) return fallback;
  const normalized = stripControlChars(value).replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

export function sanitizeMultilineText(value: string | undefined | null, fallback = ''): string {
  if (!value) return fallback;
  const normalized = stripControlChars(value)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || fallback;
}

export function sanitizeColorValue(value: string | undefined | null, fallback = ''): string {
  const normalized = sanitizeSingleLineText(value, '').toLowerCase();
  if (!normalized) return fallback;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(normalized)) return normalized;
  if (/^rgba?\([\d\s.,%]+\)$/.test(normalized)) return normalized;
  if (/^hsla?\([\d\s.,%]+\)$/.test(normalized)) return normalized;
  return fallback;
}

export function sanitizeUrl(value: string | undefined | null, options?: SanitizeUrlOptions): string {
  const fallback = options?.fallback ?? '';
  const normalized = stripControlChars((value || '').trim());
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    return fallback;
  }

  if (normalized.startsWith('#')) {
    return options?.allowAnchor === false ? fallback : normalized;
  }

  if (
    options?.allowRelative !== false &&
    (normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../'))
  ) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }

    if (options?.allowMailto !== false && parsed.protocol === 'mailto:') {
      return parsed.toString();
    }

    if (options?.allowTel !== false && parsed.protocol === 'tel:') {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function sanitizeImageUrl(value: string | undefined | null, fallback = ''): string {
  return sanitizeUrl(value, {
    fallback,
    allowRelative: true,
    allowAnchor: false,
    allowMailto: false,
    allowTel: false,
  });
}

export function serializeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
