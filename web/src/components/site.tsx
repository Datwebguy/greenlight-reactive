import Link from "next/link";
import { ConnectButton } from "./connect";
import { Logo } from "./ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Greenlight home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-[14px] sm:gap-2">
          <Link href="/#how" className="hidden rounded-lg px-3 py-2 text-ink-2 hover:text-ink sm:inline">
            How it works
          </Link>
          <Link href="/live" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">
            Live
          </Link>
          <Link href="/app" className="rounded-lg px-3 py-2 text-ink-2 hover:text-ink">
            My account
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-[13px] text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Greenlight runs on test networks with test funds.</span>
        <span className="flex gap-4">
          <a href="https://github.com/Datwebguy/greenlight-reactive" className="hover:text-ink">
            Source
          </a>
          <a href="https://dev.reactive.network" className="hover:text-ink">
            Reactive Network
          </a>
          <a href="https://docs.near.ai/cloud/private-inference" className="hover:text-ink">
            NEAR AI Cloud
          </a>
        </span>
      </div>
    </footer>
  );
}
