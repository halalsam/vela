import { Suspense } from 'react';
import { InboxView } from '@/components/admin/InboxView';

export default function AdminInboxPage() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  );
}
