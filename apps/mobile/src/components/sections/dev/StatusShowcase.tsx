import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Chip, Pill, toast } from '@/components/ui';
import { ShowcaseRow, ShowcaseSection } from './ShowcaseSection';

const filters = ['countries', 'regions', 'global'] as const;
type Filter = (typeof filters)[number];

export function StatusShowcase() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('countries');
  const [showPaid, setShowPaid] = useState(true);

  return (
    <ShowcaseSection title={t('dev.sections.status')} note={t('dev.notes.toast')}>
      <ShowcaseRow>
        <Pill label={t('dev.pills.active')} tone="success" dot />
        <Pill label={t('dev.pills.low')} tone="warning" dot />
        <Pill label={t('dev.pills.expired')} tone="danger" />
        <Pill label={t('dev.pills.best')} tone="accent" caps />
        <Pill label={t('dev.pills.new')} caps size="sm" />
        <Pill label={t('dev.pills.fiveG')} icon="signal" />
      </ShowcaseRow>
      <ShowcaseRow>
        {filters.map((key) => (
          <Chip key={key} label={t(`dev.chips.${key}`)} selected={filter === key} onPress={() => setFilter(key)} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow>
        <Chip label={t('dev.chips.hotspot')} icon="signal" />
        <Chip label={t('dev.chips.instant')} icon="bolt" />
      </ShowcaseRow>
      <Banner
        tone="warning"
        title={t('dev.banners.lowTitle')}
        body={t('dev.banners.lowBody')}
        action={{ label: t('dev.buttons.topUp'), onPress: () => toast.show({ message: t('dev.toasts.low'), tone: 'warning' }) }}
      />
      <Banner tone="info" icon="offline" title={t('dev.banners.offlineTitle')} body={t('dev.banners.offlineBody')} />
      <Banner
        tone="danger"
        title={t('dev.banners.errorTitle')}
        body={t('dev.banners.errorBody')}
        action={{ label: t('dev.banners.retry'), onPress: () => toast.show({ message: t('dev.toasts.failed'), tone: 'danger' }) }}
      />
      {showPaid ? (
        <Banner
          tone="success"
          title={t('dev.banners.paidTitle')}
          body={t('dev.banners.paidBody')}
          onDismiss={() => setShowPaid(false)}
        />
      ) : null}
      <ShowcaseRow>
        <Button
          label={t('dev.toasts.showCopied')}
          size="sm"
          variant="secondary"
          icon="copy"
          onPress={() => toast.show({ message: t('dev.toasts.copied'), tone: 'success', icon: 'check' })}
        />
        <Button
          label={t('dev.toasts.showWarning')}
          size="sm"
          variant="secondary"
          onPress={() => toast.show({ message: t('dev.toasts.low'), tone: 'warning' })}
        />
        <Button
          label={t('dev.toasts.showError')}
          size="sm"
          variant="secondary"
          onPress={() => toast.show({ message: t('dev.toasts.failed'), tone: 'danger' })}
        />
      </ShowcaseRow>
    </ShowcaseSection>
  );
}
