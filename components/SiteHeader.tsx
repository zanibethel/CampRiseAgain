"use client";

import { useEffect, useRef, useState } from "react";
import HomeManagedPanel from "@/components/HomeManagedPanel";
import ManagedLogo from "@/components/ManagedLogo";
import DonateButton from "@/components/DonateButton";

const mobilePrimaryLinks = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About the Camp" },
  { href: "/resources", label: "Resources" },
  { href: "/faq", label: "FAQs" },
];

const mobileSecondaryLinks = [
  { href: "/past-camps", label: "Past Camps" },
  { href: "/michael-garza", label: "Our Story" },
  { href: "/#contact", label: "Contact" },
];

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideInteraction(event: Event) {
      if (event.target instanceof Node && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function handlePageScroll() {
      // Keep the menu usable if its own list scrolls, but close on page scroll.
      setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutsideInteraction, true);
    document.addEventListener("touchstart", handleOutsideInteraction, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handlePageScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction, true);
      document.removeEventListener("touchstart", handleOutsideInteraction, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handlePageScroll);
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
            <a href="/faq">FAQs</a>
            <a href="/past-camps">Past Camps</a>
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
              {mobilePrimaryLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="mobile-menu-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <div className="mobile-menu-action-group" role="group" aria-label="Support and participate">
                <DonateButton
                  label="Donate"
                  className="mobile-menu-link mobile-menu-donate"
                  onClick={() => setMenuOpen(false)}
                />
                <a className="mobile-menu-link mobile-menu-apply" href="/apply" onClick={() => setMenuOpen(false)}>Apply</a>
                <a className="mobile-menu-link mobile-menu-volunteer" href="/volunteer" onClick={() => setMenuOpen(false)}>Volunteer</a>
              </div>
              {mobileSecondaryLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="mobile-menu-link"
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
