import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function UsageScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.usage"
      links={[
        { href: '/top-up', labelKey: 'screens.topUp' },
      ]}
    />
  );
}
