import { notFound } from 'next/navigation';
import { aliasedPageRegistry } from '@/lib/aliased-pages';

interface TeacherAliasedPageProps {
  params: Promise<{ target: string[] }>;
}

export default async function TeacherAliasedPage({ params }: TeacherAliasedPageProps) {
  const { target } = await params;
  const targetPath = `/${target.join('/')}`;
  const PageComponent = aliasedPageRegistry[targetPath];

  if (!PageComponent) {
    notFound();
  }

  return <PageComponent />;
}
