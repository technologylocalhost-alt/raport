import { notFound } from 'next/navigation';
import { aliasedPageRegistry } from '@/lib/aliased-pages';

interface AdminAliasedPageProps {
  params: Promise<{ target: string[] }>;
}

export default async function AdminAliasedPage({ params }: AdminAliasedPageProps) {
  const { target } = await params;
  const targetPath = `/${target.join('/')}`;
  const PageComponent = aliasedPageRegistry[targetPath];

  if (!PageComponent) {
    notFound();
  }

  return <PageComponent />;
}
