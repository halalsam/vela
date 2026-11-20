import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ChooseView, CodeView, PhoneView, type DialCode } from '@/components/sections/auth/SignInViews';
import { haptics } from '@/lib/haptics';
import { useDevStore } from '@/stores/dev';
import { useSession, type SignInProvider } from '@/stores/session';

type View_ = 'choose' | 'phone' | 'code';

const WRONG_CODE = '000000';
const MOCK_LATENCY = 700;

export default function SignInScreen() {
  const { t } = useTranslation();
  const signIn = useSession((state) => state.signIn);
  const [view, setView] = useState<View_>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialCode, setDialCode] = useState<DialCode>('+91');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);

  function finish(provider: SignInProvider) {
    setBusy(true);
    setError(null);
    setTimeout(() => {
      setBusy(false);
      if (useDevStore.getState().scenario === 'error') {
        haptics.error();
        setError(t('signIn.error'));
        if (provider === 'phone') setView('choose');
        return;
      }
      haptics.success();
      signIn(provider);
    }, MOCK_LATENCY);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-canvas">
      <View className="flex-1 px-section pb-safe-offset-4 pt-safe-offset-4">
        {view === 'choose' ? (
          <ChooseView
            busy={busy}
            error={error}
            onApple={() => finish('apple')}
            onGoogle={() => finish('google')}
            onPhone={() => setView('phone')}
          />
        ) : view === 'phone' ? (
          <PhoneView
            dialCode={dialCode}
            number={number}
            onDialCode={setDialCode}
            onNumber={setNumber}
            onSubmit={() => {
              setCode('');
              setCodeError(false);
              setView('code');
            }}
            onBack={() => setView('choose')}
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
            onComplete={(value) => {
              if (value === WRONG_CODE) {
                setCodeError(true);
                return;
              }
              finish('phone');
            }}
            onBack={() => setView('phone')}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
