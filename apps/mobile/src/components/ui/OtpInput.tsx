import { durations } from '@vela/tokens';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View, type TextInputInstance } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { Text } from './Text';

export type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  accessibilityLabel: string;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

const SHAKE = 8;
const SHAKE_STEP = durations.shake;

export function OtpInput({
  value,
  onChange,
  onComplete,
  accessibilityLabel,
  length = 6,
  error = false,
  autoFocus = false,
  disabled = false,
}: OtpInputProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    haptics.error();
    if (reduceMotion) return;
    offset.set(
      withSequence(
        withTiming(-SHAKE, { duration: SHAKE_STEP }),
        withTiming(SHAKE, { duration: SHAKE_STEP }),
        withTiming(-SHAKE / 2, { duration: SHAKE_STEP }),
        withTiming(SHAKE / 2, { duration: SHAKE_STEP }),
        withTiming(0, { duration: SHAKE_STEP }),
      ),
    );
  }, [error, reduceMotion, offset]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, length);
    if (digits.length > value.length) haptics.tick();
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  const boxes = Array.from({ length }, (_, index) => {
    const digit = value[index] ?? '';
    const active = focused && index === Math.min(value.length, length - 1);
    return (
      <View
        key={index}
        className={cn(
          'h-14 flex-1 items-center justify-center rounded-button border bg-surface-1',
          error ? 'border-danger' : active ? 'border-fg' : digit ? 'border-line-strong' : 'border-line',
        )}
      >
        <Text variant="data-sm" tone={error ? 'danger' : 'primary'}>
          {digit}
        </Text>
      </View>
    );
  });

  return (
    <Animated.View style={shakeStyle} className={cn(disabled && 'opacity-40')}>
      <View
        className="flex-row gap-2 rtl:flex-row-reverse"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {boxes}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        keyboardAppearance="dark"
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 text-transparent opacity-0"
      />
    </Animated.View>
  );
}
