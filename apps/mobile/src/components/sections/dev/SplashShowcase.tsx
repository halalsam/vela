import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui';
import { VelaSplash } from '@/components/esim';
import { colors } from '@vela/tokens';
import { ShowcaseRow, ShowcaseSection } from './ShowcaseSection';

export function SplashShowcase() {
  const { t } = useTranslation();
  const [run, setRun] = useState(0);
  return (
    <ShowcaseSection title={t('dev.sections.splash')} note={t('dev.notes.splash')}>
      <Card padding="none" className="overflow-hidden bg-canvas-deep">
        <VelaSplash key={`intro-${run}`} mode="intro" markHeight={64} className="h-40" />
      </Card>
      <ShowcaseRow className="flex-nowrap">
        <Card padding="none" className="flex-1">
          <VelaSplash key={`build-${run}`} mode="build" markHeight={56} color={colors.accent.DEFAULT} className="h-28" />
        </Card>
        <Card padding="none" className="flex-1">
          <VelaSplash mode="loop" markHeight={56} accessibilityLabel={t('esim.processing')} className="h-28" />
        </Card>
      </ShowcaseRow>
      <Button label={t('dev.buttons.replay')} variant="secondary" icon="sparkles" fullWidth onPress={() => setRun((value) => value + 1)} />
    </ShowcaseSection>
  );
}
