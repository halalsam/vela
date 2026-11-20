import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function ProcessingScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.processing"
      showTitleInContent
      links={[
        { href: '/success', labelKey: 'screens.success', replace: true },
      ]}
    />
  );
}
