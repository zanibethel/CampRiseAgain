"use client";

import { useEffect, useRef, useState } from "react";
import HomeManagedPanel from "@/components/HomeManagedPanel";
import ManagedLogo from "@/components/ManagedLogo";

const mobileLinks = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About the Camp" },
  { href: "/resources", label: "Resources" },
  { href: "/michael-garza", label: "Our Story" },
  { href: "/#contact", label: "Contact" },
  { href: "/apply", label: "Apply", kind: "apply" },
  { href: "/volunteer", label: "Volunteer", kind: "volunteer" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header>
        <div className="nav">
          <a className="brand" href="/" aria-label="Camp Rise Again home">
            <ManagedLogo width={48} height={48} priority />
            <span>Camp Rise Again</span>
          </a>

          {/* Ordinary links intentionally start each full-page navigation at the top.
              Hash links still jump to the requested home-page section. */}
          <nav className="navlinks desktop-nav" aria-label="Primary navigation">
            <a href="/#about">About</a>
            <a className="resources-link" href="/resources">Resources</a>
            <a className="legacy-link" href="/michael-garza">Our Story</a>
            <a href="/#contact">Contact</a>
            <a className="btn btn-primary" href="/apply">Apply</a>
            <a className="btn btn-secondary" href="/volunteer">Volunteer</a>
          </nav>

          <div className="mobile-menu" ref={menuRef}>
            <button
              type="button"
              className="mobile-menu-toggle"
              ref={toggleRef}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="camp-mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="mobile-menu-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <nav
              id="camp-mobile-navigation"
              className="mobile-menu-panel"
              aria-label="Mobile navigation"
              hidden={!menuOpen}
            >
              {mobileLinks.map(({ href, label, kind }) => (
                <a
                  key={href}
                  href={href}
                  className={kind ? `mobile-menu-link mobile-menu-${kind}` : "mobile-menu-link"}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <HomeManagedPanel />
    </>
  );
}
