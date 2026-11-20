import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function SignInScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.signIn"
      showTitleInContent
      links={[
        { href: '/', labelKey: 'screens.home', dismissTo: true },
      ]}
    />
  );
}
