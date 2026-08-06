'use client';
import AppMenu from './AppMenu';

export default function Header() {
  return (
    <header className="flex h-8 w-full flex-row items-center justify-end px-8">
      <AppMenu />
    </header>
  );
}
