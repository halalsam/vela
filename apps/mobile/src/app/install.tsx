import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { InstallStep } from '@/components/esim';
import { Banner, Button, StepBar, toast } from '@/components/ui';

const steps = [1, 2, 3, 4] as const;

export default function InstallScreen() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(1);
  const last = current === steps.length;
  const tip = current === 2 ? t('install.tipWifi') : current === 4 ? t('install.tipLand') : null;

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen
        options={{
          title: t('install.title'),
          headerRight: () => <Button label={t('install.help')} variant="ghost" size="sm" onPress={() => router.push('/support')} />,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-section pb-8 pt-4">
        <StepBar total={steps.length} current={current} />
        <View>
          {steps.map((step) => (
            <InstallStep
              key={step}
              number={step}
              title={t(`install.s${step}`)}
              body={step === current ? t(`install.b${step}`) : undefined}
              state={step < current ? 'done' : step === current ? 'current' : 'upcoming'}
              last={step === steps.length}
            />
          ))}
        </View>
        {tip ? <Banner tone="info" title={tip} /> : null}
      </ScrollView>
      <View className="flex-row gap-3 border-t border-line px-section pb-safe-offset-3 pt-3">
        {current > 1 ? <Button label={t('common.back')} variant="secondary" onPress={() => setCurrent((value) => value - 1)} /> : null}
        <View className="flex-1">
          {last ? (
            <Button
              label={t('install.connected')}
              fullWidth
              onPress={() => {
                toast.show({ message: t('success.title'), tone: 'success' });
                router.dismissTo('/esims');
              }}
            />
          ) : (
            <Button label={t('common.next')} fullWidth icon="arrowForward" iconPosition="end" onPress={() => setCurrent((value) => value + 1)} />
          )}
        </View>
      </View>
    </View>
  );
}
