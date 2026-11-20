import { countries, esims, offers, plans, regions } from '@vela/api/mocks';
import { bestValuePlanId } from '@vela/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import {
  ActiveEsimCard,
  CountryRow,
  InstallStep,
  ManualCodeRow,
  OfferStrip,
  PlanCard,
  PriceOdometer,
  QrCard,
  RegionRow,
  UsageRing,
  ValidityCountdown,
} from '@/components/esim';
import { Button, Card, ListGroup, toast } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';
import { ShowcaseRow, ShowcaseSection } from './ShowcaseSection';

const japanPlans = plans.filter((plan) => plan.country_codes[0] === 'JP');
const [japan, thailand, uae, france] = esims;
const endingSoon = new Date(Date.now() + 5 * 3_600_000).toISOString();

function splitLpa(lpa: string) {
  const [, smdp = '', code = ''] = lpa.split('$');
  return { smdp, code };
}

export function UsageShowcase() {
  const { t } = useTranslation();
  const [priceIndex, setPriceIndex] = useState(1);
  const price = japanPlans[priceIndex]?.price ?? 0;
  if (!japan || !thailand || !uae || !france) return null;
  return (
    <ShowcaseSection title={t('dev.sections.usage')} note={t('dev.notes.odometer')}>
      <Card padding="lg" className="items-center gap-5">
        <UsageRing usedMb={japan.data_used_mb} totalMb={japan.data_total_mb} size="lg" />
        <ValidityCountdown expiresAt={japan.expires_at} />
      </Card>
      <ShowcaseRow className="justify-between">
        <UsageRing usedMb={uae.data_used_mb} totalMb={uae.data_total_mb} state="low" />
        <UsageRing usedMb={0} totalMb={thailand.data_total_mb} state="pending" />
        <UsageRing usedMb={france.data_used_mb} totalMb={france.data_total_mb} state="expired" />
      </ShowcaseRow>
      <ShowcaseRow>
        <UsageRing usedMb={japan.data_used_mb} totalMb={japan.data_total_mb} size="sm" />
        <UsageRing usedMb={uae.data_used_mb} totalMb={uae.data_total_mb} size="sm" state="low" />
        <ValidityCountdown expiresAt={uae.expires_at} variant="pill" precision="hours" />
        <ValidityCountdown expiresAt={endingSoon} variant="pill" />
        <ValidityCountdown expiresAt={france.expires_at} variant="pill" />
        <ValidityCountdown expiresAt={null} variant="pill" />
      </ShowcaseRow>
      <Card padding="lg" className="flex-row items-center justify-between">
        <PriceOdometer amount={price} currency="INR" variant="data-lg" />
        <Button
          label={t('dev.buttons.nextPrice')}
          size="sm"
          pill
          variant="secondary"
          onPress={() => setPriceIndex((value) => (value + 1) % japanPlans.length)}
        />
      </Card>
    </ShowcaseSection>
  );
}

export function PlansShowcase() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(japanPlans[1]?.id);
  const best = bestValuePlanId(japanPlans);
  return (
    <ShowcaseSection title={t('dev.sections.plans')}>
      <View className="gap-card-gap" accessibilityRole="radiogroup">
        {japanPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={plan.id === selected}
            dimmed={Boolean(selected) && plan.id !== selected}
            bestValue={plan.id === best}
            onPress={() => setSelected(plan.id)}
          />
        ))}
      </View>
      <ListGroup>
        {countries.slice(0, 4).map((country) => (
          <CountryRow key={country.code} country={country} onPress={() => undefined} />
        ))}
      </ListGroup>
      <ListGroup>
        {regions.map((region) => (
          <RegionRow key={region.id} region={region} onPress={() => undefined} />
        ))}
      </ListGroup>
    </ShowcaseSection>
  );
}

export function EsimCardsShowcase() {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <ShowcaseSection title={t('dev.sections.esimCards')}>
      <OfferStrip offers={offers} onPressOffer={(offer) => toast.show({ message: localized(offer.title) })} />
      {esims.slice(0, 3).map((esim) => (
        <ActiveEsimCard key={esim.iccid} esim={esim} onTopUp={() => toast.show({ message: t('esim.topUp') })} />
      ))}
    </ShowcaseSection>
  );
}

export function QrShowcase() {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  if (!japan) return null;
  const { smdp, code } = splitLpa(japan.lpa_string);
  return (
    <ShowcaseSection title={t('dev.sections.qr')}>
      <QrCard value={japan.lpa_string} revealed={revealed} onReveal={() => setRevealed(true)} />
      <Button label={t('dev.buttons.flip')} size="sm" pill variant="secondary" className="self-center" onPress={() => setRevealed((value) => !value)} />
      <ListGroup>
        <ManualCodeRow label={t('esim.smdp')} value={smdp} />
        <ManualCodeRow label={t('esim.activationCode')} value={code} />
      </ListGroup>
    </ShowcaseSection>
  );
}

export function InstallShowcase() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(2);
  const steps = [1, 2, 3, 4] as const;
  return (
    <ShowcaseSection title={t('dev.sections.install')}>
      <Card padding="lg">
        {steps.map((step) => (
          <InstallStep
            key={step}
            number={step}
            title={t(`dev.install.s${step}`)}
            body={t(`dev.install.b${step}`)}
            state={step < current ? 'done' : step === current ? 'current' : 'upcoming'}
            last={step === steps.length}
          />
        ))}
      </Card>
      <Button label={t('dev.buttons.nextStep')} variant="secondary" fullWidth onPress={() => setCurrent((value) => (value % 5) + 1)} />
    </ShowcaseSection>
  );
}
