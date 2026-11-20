import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function OnboardingScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.onboarding"
      showTitleInContent
      links={[
        { href: '/sign-in', labelKey: 'screens.signIn', replace: true },
      ]}
    />
  );
}
