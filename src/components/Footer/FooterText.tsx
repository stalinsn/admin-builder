import { labels } from '@/data/labels';
import { useI18n } from '@/hooks/useI18n';

export default function FooterText() {
  const { lang } = useI18n();
  const footerText = labels.footer?.[lang as keyof typeof labels.footer] || "Todos os direitos reservados.";
  return <span> {footerText}</span>;
}
