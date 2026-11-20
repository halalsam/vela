import type { Esim } from '@vela/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, toast } from '@/components/ui';
import { liveActivity } from '@/lib/liveActivity';
import { tripStartFor } from '@/lib/widgetSync';

export function LiveActivityToggle({ esim }: { esim: Esim }) {
  const { t } = useTranslation();
  const [tracking, setTracking] = useState(() => liveActivity.trackedIccids().includes(esim.iccid));
  const [busy, setBusy] = useState(false);
  if (!liveActivity.isSupported() || (esim.status !== 'active' && esim.status !== 'not_started')) return null;

  async function toggle() {
    setBusy(true);
    try {
      if (tracking) {
        await liveActivity.end(esim.iccid);
        setTracking(false);
      } else {
        await liveActivity.start(tripStartFor(esim));
        setTracking(true);
        toast.show({ message: t('usage.trackStarted'), tone: 'success' });
      }
    } catch {
      toast.show({ message: t('usage.trackFailed'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      label={tracking ? t('usage.trackOff') : t('usage.trackOn')}
      icon={tracking ? 'close' : 'bolt'}
      variant="secondary"
      fullWidth
      loading={busy}
      onPress={() => void toggle()}
    />
  );
}
