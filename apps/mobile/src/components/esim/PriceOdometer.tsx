import { formatPrice, type CurrencyCode } from '@vela/utils';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text, type Tone } from '@/components/ui';
import { useOdometer } from '@/hooks/useOdometer';
import { cn } from '@/lib/cn';

export type PriceOdometerVariant = 'data-sm' | 'data-md' | 'data-lg';

const rows: Record<PriceOdometerVariant, { height: number; frame: string; cell: string }> = {
  'data-sm': { height: 24, frame: 'h-6', cell: 'h-6' },
  'data-md': { height: 32, frame: 'h-8', cell: 'h-8' },
  'data-lg': { height: 44, frame: 'h-11', cell: 'h-11' },
};

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function DigitColumn({ digit, variant, tone }: { digit: number; variant: PriceOdometerVariant; tone: Tone }) {
  const row = rows[variant];
  const style = useOdometer(digit, row.height);
  return (
    <View className={cn('overflow-hidden', row.frame)}>
      <Animated.View style={style}>
        {DIGITS.map((value) => (
          <Text key={value} variant={variant} tone={tone} className={row.cell}>
            {value}
          </Text>
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
    <View accessible accessibilityLabel={formatted} className={cn('flex-row items-center rtl:flex-row-reverse', className)}>
      {chars.map((char, index) => {
        const key = `${chars.length - index}`;
        return /\d/.test(char) ? (
          <DigitColumn key={key} digit={Number(char)} variant={variant} tone={tone} />
        ) : (
          <Text key={key} variant={variant} tone={tone} className={rows[variant].cell}>
            {char}
          </Text>
        );
      })}
    </View>
  );
}
