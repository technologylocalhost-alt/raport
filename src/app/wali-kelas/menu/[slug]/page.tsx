import { notFound } from 'next/navigation';
import { getCanonicalPathFromAliasSlug } from '@/lib/menu-alias';
import { aliasedPageRegistry } from '@/lib/aliased-pages';

interface WaliKelasAliasedMenuPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WaliKelasAliasedMenuPage({ params }: WaliKelasAliasedMenuPageProps) {
  const { slug } = await params;
  const targetPath = getCanonicalPathFromAliasSlug(slug);

  if (!targetPath) notFound();

  const PageComponent = aliasedPageRegistry[targetPath];
  if (!PageComponent) notFound();

  return <PageComponent />;
}
