import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { Text } from './Text';

export type SectionIndexProps = {
  letters: readonly string[];
  onSelect: (index: number) => void;
  className?: string;
};

export function SectionIndex({ letters, onSelect, className }: SectionIndexProps) {
  const { t } = useTranslation();
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const last = useRef<number | null>(null);

  function pick(event: GestureResponderEvent) {
    if (height <= 0 || letters.length === 0) return;
    const index = Math.min(letters.length - 1, Math.max(0, Math.floor((event.nativeEvent.locationY / height) * letters.length)));
    if (index === last.current) return;
    last.current = index;
    setActive(index);
    haptics.tick();
    onSelect(index);
  }

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      onResponderRelease={() => {
        last.current = null;
        setActive(null);
      }}
      onResponderTerminate={() => {
        last.current = null;
        setActive(null);
      }}
      className={cn('items-center py-1', className)}
    >
      {letters.map((letter, index) => (
        <View
          key={letter}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('explore.indexLabel', { letter })}
          onAccessibilityTap={() => onSelect(index)}
          className={cn('h-4 w-5 items-center justify-center rounded-chip', active === index && 'bg-fg')}
        >
          <Text variant="label-sm" tone={active === index ? 'inverse' : 'accent'} className="tracking-normal">
            {letter}
          </Text>
        </View>
      ))}
    </View>
  );
}
