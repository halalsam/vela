import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function NotFoundScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.notFound"
      showTitleInContent
      links={[
        { href: '/', labelKey: 'screens.home', dismissTo: true },
      ]}
    />
  );
}
