import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function EsimsScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.esims"
      links={[
        { href: '/usage/demo', labelKey: 'screens.usage' },
        { href: '/install', labelKey: 'screens.install' },
      ]}
    />
  );
}
