import { notFound } from 'next/navigation';
import { getCanonicalPathFromAliasSlug } from '@/lib/menu-alias';
import { aliasedPageRegistry } from '@/lib/aliased-pages';

interface TeacherAliasedMenuPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TeacherAliasedMenuPage({ params }: TeacherAliasedMenuPageProps) {
  const { slug } = await params;
  const targetPath = getCanonicalPathFromAliasSlug(slug);

  if (!targetPath) notFound();

  const PageComponent = aliasedPageRegistry[targetPath];
  if (!PageComponent) notFound();

  return <PageComponent />;
}
