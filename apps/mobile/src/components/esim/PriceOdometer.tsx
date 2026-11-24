import { formatPrice, type CurrencyCode } from '@vela/utils';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text, type Tone } from '@/components/ui';
import { useOdometer } from '@/hooks/useOdometer';
import { cn } from '@/lib/cn';

export type PriceOdometerVariant = 'data-sm' | 'data-md' | 'data-lg';

// Cell height must equal the reel's scroll step exactly, so it is set in points, not classes.
const rows: Record<PriceOdometerVariant, { height: number }> = {
  'data-sm': { height: 24 },
  'data-md': { height: 32 },
  'data-lg': { height: 44 },
};

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function DigitColumn({ digit, variant, tone }: { digit: number; variant: PriceOdometerVariant; tone: Tone }) {
  const row = rows[variant];
  const style = useOdometer(digit, row.height);
  return (
    <View style={{ height: row.height, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {DIGITS.map((value) => (
          <View key={value} style={{ height: row.height, justifyContent: 'center' }}>
            <Text variant={variant} tone={tone}>
              {value}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export type PriceOdometerProps = {
  amount: number;
  currency: CurrencyCode;
  variant?: PriceOdometerVariant;
  tone?: Tone;
  className?: string;
};

export function PriceOdometer({ amount, currency, variant = 'data-md', tone = 'primary', className }: PriceOdometerProps) {
  const formatted = formatPrice(amount, currency);
  const chars = [...formatted];
  return (
    <View accessible accessibilityLabel={formatted} style={{ direction: 'ltr' }} className={cn('flex-row items-center', className)}>
      {chars.map((char, index) => {
        const key = `${chars.length - index}`;
        return /\d/.test(char) ? (
          <DigitColumn key={key} digit={Number(char)} variant={variant} tone={tone} />
        ) : (
          <View key={key} style={{ height: rows[variant].height, justifyContent: 'center' }}>
            <Text variant={variant} tone={tone}>
              {char}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
