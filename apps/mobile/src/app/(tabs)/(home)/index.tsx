import { BrandCheckSection } from '@/components/sections/BrandCheckSection';
import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function HomeScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.home"
      links={[
        { href: '/country/jp', labelKey: 'screens.country' },
        { href: '/usage/demo', labelKey: 'screens.usage' },
        { href: '/onboarding', labelKey: 'screens.onboarding' },
        { href: '/sign-in', labelKey: 'screens.signIn' },
      ]}
    >
      <BrandCheckSection />
    </ScreenPlaceholder>
  );
}
