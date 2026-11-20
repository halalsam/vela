import type { Esim } from '@vela/api';
import { durations } from '@vela/tokens';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ManualCodeRow } from '@/components/esim';
import { Button, Icon, ListGroup, Text } from '@/components/ui';
import { reducedFadeIn } from '@/lib/motion';

const STEP_MS = 900;
const stepKeys = ['processing.step1', 'processing.step2', 'processing.step3'] as const;

export function ProcessingSteps({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= stepKeys.length) {
      const timer = setTimeout(onDone, durations.base);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setStep((value) => value + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, onDone]);

  return (
    <View className="gap-3 self-center" accessibilityLiveRegion="polite">
      {stepKeys.map((key, index) => {
        const done = index < step;
        const current = index === step;
        if (index > step) return null;
        return (
          <Animated.View key={key} entering={reducedFadeIn} className="flex-row items-center gap-3">
            <View className="h-5 w-5 items-center justify-center">
              {done ? <Icon name="check" size={14} tone="success" weight="bold" /> : <View className="h-1.5 w-1.5 rounded-pill bg-accent" />}
            </View>
            <Text tone={current ? 'primary' : 'tertiary'}>{t(key)}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function splitLpa(lpa: string) {
  const [, smdp = '', code = ''] = lpa.split('$');
  return { smdp, code };
}

function supportsDirectInstall() {
  if (Platform.OS !== 'ios') return false;
  const [major = 0, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 17 || (major === 17 && minor >= 4);
}

export function InstallActions({ esim }: { esim: Esim }) {
  const { t } = useTranslation();
  const { smdp, code } = splitLpa(esim.lpa_string);
  const direct = supportsDirectInstall();
  return (
    <View className="gap-card-gap">
      {direct ? (
        <Button
          label={t('success.installHere')}
          icon="arrowUpForward"
          fullWidth
          onPress={() =>
            void Linking.openURL(
              `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(esim.lpa_string)}`,
            )
          }
        />
      ) : (
        <Text variant="callout" tone="secondary" align="center">
          {t('success.installUnsupported')}
        </Text>
      )}
      <ListGroup header={t('success.manual')}>
        <ManualCodeRow label={t('esim.smdp')} value={smdp} />
        <ManualCodeRow label={t('esim.activationCode')} value={code} />
      </ListGroup>
    </View>
  );
}
