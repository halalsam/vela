import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';

type ShowcaseSectionProps = {
  title: string;
  note?: string;
  children: ReactNode;
};

export function ShowcaseSection({ title, note, children }: ShowcaseSectionProps) {
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text variant="label" tone="tertiary" accessibilityRole="header">
          {title}
        </Text>
        {note ? (
          <Text variant="caption" tone="tertiary">
            {note}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function ShowcaseRow({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('flex-row flex-wrap items-center gap-3', className)}>{children}</View>;
}
