import { BlogEditor } from '@/components/admin/BlogEditor';

export default async function AdminEditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key: a fresh editor per post, so state never leaks between posts.
  return <BlogEditor key={id} id={id} />;
}
