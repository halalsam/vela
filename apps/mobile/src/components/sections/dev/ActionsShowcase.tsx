import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/ui';
import { ShowcaseRow, ShowcaseSection } from './ShowcaseSection';

export function ActionsShowcase() {
  const { t } = useTranslation();
  return (
    <ShowcaseSection title={t('dev.sections.actions')}>
      <Button label={t('dev.buttons.continue')} fullWidth icon="arrowForward" iconPosition="end" />
      <Button label={t('dev.buttons.compare')} variant="secondary" fullWidth />
      <Button label={t('dev.buttons.later')} variant="ghost" fullWidth />
      <Button label={t('dev.buttons.claim')} variant="accent" icon="gift" fullWidth />
      <Button label={t('dev.buttons.remove')} variant="danger" fullWidth />
      <Button label={t('dev.buttons.loading')} loading fullWidth />
      <Button label={t('dev.buttons.disabled')} disabled fullWidth />
      <ShowcaseRow>
        <Button label={t('dev.buttons.topUp')} size="sm" pill icon="plus" />
        <Button label={t('dev.buttons.share')} size="sm" variant="secondary" pill icon="share" />
        <Button label={t('dev.buttons.continue')} size="sm" variant="ghost" />
      </ShowcaseRow>
      <ShowcaseRow>
        <IconButton icon="arrowBack" accessibilityLabel={t('dev.buttons.back')} />
        <IconButton icon="share" variant="glass" accessibilityLabel={t('dev.buttons.share')} />
        <IconButton icon="plus" variant="primary" accessibilityLabel={t('dev.buttons.add')} />
        <IconButton icon="close" variant="ghost" accessibilityLabel={t('dev.buttons.close')} />
        <IconButton icon="close" size="sm" accessibilityLabel={t('dev.buttons.close')} />
        <IconButton icon="share" disabled accessibilityLabel={t('dev.buttons.share')} />
      </ShowcaseRow>
    </ShowcaseSection>
  );
}
