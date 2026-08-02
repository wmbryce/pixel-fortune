import { Suspense } from 'react';
import PrototypeClient from './PrototypeClient';

// PROTOTYPE — see PrototypeClient.tsx. Delete with #14.
export default function Page() {
  return (
    <Suspense>
      <PrototypeClient />
    </Suspense>
  );
}
