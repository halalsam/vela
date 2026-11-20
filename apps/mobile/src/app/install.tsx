import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function InstallScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.install"
      links={[
        { href: '/esims', labelKey: 'screens.esims', dismissTo: true },
      ]}
    />
  );
}
