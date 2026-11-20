import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function CountryScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.country"
      links={[
        { href: '/checkout', labelKey: 'screens.checkout' },
      ]}
    />
  );
}
