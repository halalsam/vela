import { Stack } from 'expo-router';
import { largeTitleStackOptions } from '@/lib/navigation';

export default function SearchStackLayout() {
  return <Stack screenOptions={largeTitleStackOptions} />;
}
