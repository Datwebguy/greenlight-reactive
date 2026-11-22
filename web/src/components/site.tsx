import Link from "next/link";
import { ConnectButton } from "./connect";
import { ThemeToggle } from "./theme";
import { Logo } from "./ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30">
      <div className="mx-3 mt-3 flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-card px-3 pl-4 shadow-card backdrop-blur-xl sm:mx-auto sm:px-3 sm:pl-5">
        <Link href="/" aria-label="Greenlight home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-0.5 text-[14px] sm:gap-1">
          <Link href="/#how" className="hidden rounded-lg px-3 py-2 text-ink-2 transition hover:text-ink md:inline">
            How it works
          </Link>
          <Link href="/live" className="rounded-lg px-2.5 py-2 text-ink-2 transition hover:text-ink sm:px-3">
            Live
          </Link>
          <Link href="/app" className="rounded-lg px-2.5 py-2 text-ink-2 transition hover:text-ink sm:px-3">
            Account
          </Link>
          <span className="ml-1 flex items-center gap-2">
            <ThemeToggle />
            <ConnectButton />
          </span>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-mute">
            An AI that trades with your money, on a limit it has to earn. Running on test networks with test funds.
          </p>
        </div>
        <div className="text-[14px]">
          <div className="font-semibold text-ink">Product</div>
          <ul className="mt-3 space-y-2 text-mute">
            <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
            <li><Link href="/live" className="hover:text-ink">Live agents</Link></li>
            <li><Link href="/app" className="hover:text-ink">Open an account</Link></li>
          </ul>
        </div>
        <div className="text-[14px]">
          <div className="font-semibold text-ink">Built on</div>
          <ul className="mt-3 space-y-2 text-mute">
            <li><a href="https://dev.reactive.network" className="hover:text-ink">Reactive Network</a></li>
            <li><a href="https://docs.near.ai/cloud/private-inference" className="hover:text-ink">NEAR AI Cloud</a></li>
            <li><a href="https://github.com/Datwebguy/greenlight-reactive" className="hover:text-ink">Source code</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
