import { ScreenPlaceholder } from '@/components/sections/ScreenPlaceholder';

export default function CheckoutScreen() {
  return (
    <ScreenPlaceholder
      titleKey="screens.checkout"
      showTitleInContent
      links={[
        { href: '/processing', labelKey: 'screens.processing' },
      ]}
    />
  );
}
