import { notFound } from 'next/navigation';
import { getCanonicalPathFromAliasSlug } from '@/lib/menu-alias';
import { aliasedPageRegistry } from '@/lib/aliased-pages';

interface AdminAliasedMenuPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminAliasedMenuPage({ params }: AdminAliasedMenuPageProps) {
  const { slug } = await params;
  const targetPath = getCanonicalPathFromAliasSlug(slug);

  if (!targetPath) notFound();

  const PageComponent = aliasedPageRegistry[targetPath];
  if (!PageComponent) notFound();

  return <PageComponent />;
}
