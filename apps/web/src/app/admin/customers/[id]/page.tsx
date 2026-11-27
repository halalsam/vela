import { CustomerView } from '@/components/admin/CustomersView';

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerView id={decodeURIComponent(id)} />;
}
