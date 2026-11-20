import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, OtpInput } from '@/components/ui';
import { ShowcaseSection } from './ShowcaseSection';

const WRONG_CODE = '000000';

export function InputsShowcase() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [coupon, setCoupon] = useState('TRAVEL10');
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);

  return (
    <ShowcaseSection title={t('dev.sections.inputs')} note={t('dev.notes.otp')}>
      <Input
        label={t('dev.inputs.email')}
        placeholder={t('dev.inputs.emailPlaceholder')}
        helper={t('dev.inputs.emailHelper')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        clearable
      />
      <Input
        label={t('dev.inputs.coupon')}
        leadingIcon="tag"
        value={coupon}
        onChangeText={setCoupon}
        autoCapitalize="characters"
        error={coupon === 'TRAVEL10' ? t('dev.inputs.couponError') : undefined}
      />
      <Input variant="search" placeholder={t('dev.inputs.search')} value={query} onChangeText={setQuery} returnKeyType="search" />
      <OtpInput
        accessibilityLabel={t('dev.inputs.otpLabel')}
        value={code}
        error={codeError}
        onChange={(next) => {
          setCode(next);
          if (codeError) setCodeError(false);
        }}
        onComplete={(next) => setCodeError(next === WRONG_CODE)}
      />
    </ShowcaseSection>
  );
}
