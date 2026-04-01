export function envBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  switch (String(value).trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
}

export const IS_PROD = process.env.NODE_ENV === 'production';
export const DEMO = !IS_PROD && envBool(process.env.NEXT_PUBLIC_IS_DEMO, false);
