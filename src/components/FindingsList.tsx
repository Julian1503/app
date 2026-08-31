import type { Finding } from '@shared/types.ts';
import { useI18n } from '../lib/i18n.tsx';

interface Props {
  readonly findings: readonly Finding[];
}

const CHIP_CLASS: Record<Finding['severity'], string> = {
  critical: 'chip--over',
  high: 'chip--warning',
  medium: 'chip--info',
  info: 'chip--info',
};

export function FindingsList({ findings }: Props): JSX.Element {
  const { i18n } = useI18n();
  const { t, money } = i18n;

  if (findings.length === 0) {
    return <div className="card empty">{t('findings.empty')}</div>;
  }

  const severityLabel = (severity: Finding['severity']): string => {
    switch (severity) {
      case 'critical':
        return t('findings.severity.critical');
      case 'high':
        return t('findings.severity.high');
      case 'medium':
        return t('findings.severity.medium');
      case 'info':
        return t('findings.severity.info');
    }
  };

  const categoryLabel = (category: Finding['category']): string => {
    switch (category) {
      case 'visa':
        return t('findings.category.visa');
      case 'pay':
        return t('findings.category.pay');
      case 'km':
        return t('findings.category.km');
      case 'data':
        return t('findings.category.data');
    }
  };

  return (
    <ul className="findings">
      {findings.map((finding) => (
        <li key={finding.id} className={`finding finding--${finding.severity}`}>
          <div>
            <span className={`chip ${CHIP_CLASS[finding.severity]}`}>
              {severityLabel(finding.severity)}
            </span>
            <p className="section__note" style={{ marginTop: '0.4rem' }}>
              {categoryLabel(finding.category)}
            </p>
          </div>
          <div>
            <h3 className="finding__title">{finding.title}</h3>
            <p className="finding__detail">{finding.detail}</p>
            {finding.amount !== null && (
              <span className="finding__amount">{money(finding.amount)}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
