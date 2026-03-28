'use client';

import { use } from 'react';
import { SantriFormPage } from '../../components';

export default function EditSantriPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SantriFormPage id={id} />;
}
