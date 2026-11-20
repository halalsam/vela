import { Stack } from 'expo-router';
import { largeTitleStackOptions } from '@/lib/navigation';

export default function ExploreStackLayout() {
  return <Stack screenOptions={largeTitleStackOptions} />;
}
