import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function ExploreScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.explore"
      links={[
        { href: '/country/jp', labelKey: 'screens.country' },
      ]}
    />
  );
}
