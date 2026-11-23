import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ChooseView, CodeView, PhoneView, type DialCode } from '@/components/sections/auth/SignInViews';
import { SignInError, sendPhoneCode, signInWithApple, signInWithGoogle, verifyPhoneCode } from '@/lib/auth';
import { haptics } from '@/lib/haptics';

type Step = 'choose' | 'phone' | 'code';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialCode, setDialCode] = useState<DialCode>('+91');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const phoneNumber = `${dialCode}${number.replace(/\D/g, '')}`;

  async function run(action: () => Promise<void>, onFailure?: (error: SignInError) => boolean) {
    setBusy(true);
    setError(null);
    try {
      await action();
      haptics.success();
    } catch (caught) {
      const failure = caught instanceof SignInError ? caught : new SignInError('failed');
      if (failure.reason === 'cancelled') return;
      if (onFailure?.(failure)) return;
      haptics.error();
      setError(t('signIn.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-canvas">
      <View className="flex-1 px-section pb-safe-offset-4 pt-safe-offset-4">
        {step === 'choose' ? (
          <ChooseView
            busy={busy}
            error={error}
            onApple={() => void run(signInWithApple)}
            onGoogle={() => void run(signInWithGoogle)}
            onPhone={() => setStep('phone')}
          />
        ) : step === 'phone' ? (
          <PhoneView
            dialCode={dialCode}
            number={number}
            busy={busy}
            error={error}
            onDialCode={setDialCode}
            onNumber={setNumber}
            onSubmit={() =>
              void run(async () => {
                await sendPhoneCode(phoneNumber);
                setCode('');
                setCodeError(false);
                setStep('code');
              })
            }
            onBack={() => setStep('choose')}
          />
        ) : (
          <CodeView
            phone={`${dialCode} ${number}`}
            code={code}
            error={codeError}
            busy={busy}
            onCode={(value) => {
              setCode(value);
              if (codeError) setCodeError(false);
            }}
            onComplete={(value) =>
              void run(
                () => verifyPhoneCode(phoneNumber, value),
                (failure) => {
                  if (failure.reason !== 'wrong_code') return false;
                  setCodeError(true);
                  return true;
                },
              )
            }
            onResend={() => void run(() => sendPhoneCode(phoneNumber))}
            onBack={() => setStep('phone')}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
