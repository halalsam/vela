import { Stack } from 'expo-router';
import { largeTitleStackOptions } from '@/lib/navigation';

export default function HomeStackLayout() {
  return <Stack screenOptions={largeTitleStackOptions} />;
}
