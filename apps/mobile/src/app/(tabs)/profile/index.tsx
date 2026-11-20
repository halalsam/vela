import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function ProfileScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.profile"
      links={[
        { href: '/rewards', labelKey: 'screens.rewards' },
        { href: '/support', labelKey: 'screens.support' },
        { href: '/onboarding', labelKey: 'screens.onboarding' },
        { href: '/sign-in', labelKey: 'screens.signIn' },
      ]}
    />
  );
}
