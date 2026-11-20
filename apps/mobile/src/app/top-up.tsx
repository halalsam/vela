import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function TopUpScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.topUp"
      showTitleInContent
      links={[
        { href: '/processing', labelKey: 'screens.processing' },
      ]}
    />
  );
}
