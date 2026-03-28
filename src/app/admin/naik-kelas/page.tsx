import { Suspense } from 'react';
import { NaikKelasContent } from './content';

function NaikKelasLoading() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Memuat halaman...</p>
      </div>
    </div>
  );
}

export default function NaikKelasPage() {
  return (
    <Suspense fallback={<NaikKelasLoading />}>
      <NaikKelasContent />
    </Suspense>
  );
}
