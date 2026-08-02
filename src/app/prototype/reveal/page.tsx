import { Suspense } from 'react';
import PrototypeClient from './PrototypeClient';

// PROTOTYPE — see PrototypeClient.tsx. Delete with #13.
export default function Page() {
  return (
    <Suspense>
      <PrototypeClient />
    </Suspense>
  );
}
