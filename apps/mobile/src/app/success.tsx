import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function SuccessScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.success"
      showTitleInContent
      links={[
        { href: '/install', labelKey: 'screens.install', replace: true },
        { href: '/', labelKey: 'screens.home', dismissTo: true },
      ]}
    />
  );
}
