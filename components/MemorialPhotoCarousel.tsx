"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent, type TransitionEvent } from "react";

export type CarouselPhoto = {
  id: string;
  src: string;
  caption: string;
};

type Props = {
  photos: CarouselPhoto[];
  label: string;
};

const AUTOPLAY_MS = 8000;

export default function MemorialPhotoCarousel({ photos, label }: Props) {
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(1);
  const [snapping, setSnapping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [explicitPlay, setExplicitPlay] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);

  const count = photos.length;
  const current = photos[Math.min(active, count - 1)];
  const slides = count > 1
    ? [
        { photo: photos[count - 1], photoIndex: count - 1, key: "leading-copy" },
        ...photos.map((photo, photoIndex) => ({ photo, photoIndex, key: photo.id })),
        { photo: photos[0], photoIndex: 0, key: "trailing-copy" },
      ]
    : photos.map((photo, photoIndex) => ({ photo, photoIndex, key: photo.id }));
  const autoRunning = count > 1 && !paused && (explicitPlay || (!hovered && !focused)) && inView &&
    tabVisible && !reducedMotion && !lightboxOpen;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.15 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, count - 1)));
    setPosition(count > 1 ? 1 : 0);
  }, [count]);

  useEffect(() => {
    if (!autoRunning) return;
    const interval = window.setInterval(() => {
      setActive((index) => (index + 1) % count);
      setPosition((index) => index + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(interval);
  }, [autoRunning, count]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxOpen && !dialog.open) dialog.showModal();
    if (!lightboxOpen && dialog.open) dialog.close();
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen || count < 2) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        select(active + (event.key === "ArrowRight" ? 1 : -1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, count, active, reducedMotion]);

  function select(index: number) {
    if (count < 2) return;
    setPaused(true);
    setExplicitPlay(false);
    const next = (index + count) % count;
    if (next === active) return;
    if (next === (active + 1) % count) {
      setActive(next);
      setPosition((old) => reducedMotion && old === count ? 1 : old + 1);
    } else if (next === (active - 1 + count) % count) {
      setActive(next);
      setPosition((old) => reducedMotion && old === 1 ? count : old - 1);
    } else {
      // Non-adjacent navigation jumps directly rather than racing past many photos.
      setSnapping(true);
      setActive(next);
      setPosition(next + 1);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setSnapping(false)));
    }
  }

  function finishSlide(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (position === 0 || position === count + 1) {
      // Duplicate end slides make the last/first transition seamless.
      setSnapping(true);
      setPosition(position === 0 ? count : 1);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setSnapping(false)));
    }
  }

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") { event.preventDefault(); select(active + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); select(active - 1); }
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || count < 2) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
    ignoreClick.current = true;
    window.setTimeout(() => { ignoreClick.current = false; }, 400);
    select(active + (dx < 0 ? 1 : -1));
  }

  function openLightbox(event: MouseEvent<HTMLButtonElement>) {
    if (ignoreClick.current) { event.preventDefault(); return; }
    triggerRef.current = event.currentTarget;
    setPaused(true);
    setExplicitPlay(false);
    setLightboxOpen(true);
  }

  const imageAlt = (photo: CarouselPhoto, index: number) =>
    photo.caption.trim() || `Photo ${index + 1} shared in memory of Michael Alexander Garza`;

  if (!count) return null;

  return (
    <div
      ref={containerRef}
      className={count === 1 ? "memorial-carousel memorial-carousel-single" : "memorial-carousel"}
      role="region"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        className="memorial-carousel-viewport"
        tabIndex={count > 1 ? 0 : undefined}
        aria-label={count > 1 ? "Use left and right arrow keys or swipe to browse photographs" : undefined}
        onKeyDown={count > 1 ? onKeys : undefined}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        <div
          className={`memorial-carousel-track${snapping ? " memorial-carousel-no-transition" : ""}`}
          style={{ transform: `translate3d(-${(count > 1 ? position : 0) * 100}%, 0, 0)` }}
          onTransitionEnd={finishSlide}
        >
          {slides.map(({ photo, photoIndex, key }, slidePosition) => (
            <figure className="memorial-carousel-slide" key={key} aria-hidden={slidePosition !== (count > 1 ? position : 0)}>
              <button
                type="button"
                tabIndex={slidePosition === (count > 1 ? position : 0) ? 0 : -1}
                className="memorial-carousel-image-button"
                onClick={openLightbox}
                aria-label={`Enlarge photograph ${photoIndex + 1} of ${count}`}
              >
                <img
                  src={photo.src}
                  className="memorial-carousel-image"
                  alt={imageAlt(photo, photoIndex)}
                  loading={photoIndex <= 1 ? "eager" : "lazy"}
                  decoding="async"
                />
                <span className="memorial-carousel-enlarge" aria-hidden="true">View larger ↗</span>
              </button>
              {photo.caption.trim() && <figcaption>{photo.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="memorial-carousel-controls" aria-label="Photo carousel controls">
          <button type="button" className="memorial-carousel-arrow" onClick={() => select(active - 1)} aria-label="Previous photo">‹</button>
          <button type="button" className="memorial-carousel-arrow" onClick={() => select(active + 1)} aria-label="Next photo">›</button>
          {!reducedMotion ? (
            <button
              type="button"
              className="memorial-carousel-play"
              onClick={() => {
                setPaused(!paused);
                setExplicitPlay(paused);
              }}
              aria-label={paused ? "Resume automatic photo advance" : "Pause automatic photo advance"}
              aria-pressed={paused}
            >
              {paused ? "▶ Play" : "Ⅱ Pause"}
            </button>
          ) : (
            <span className="memorial-carousel-motion-note">Manual browsing</span>
          )}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="memorial-carousel-lightbox"
        aria-label="Enlarged memorial photograph"
        onClose={() => { setLightboxOpen(false); triggerRef.current?.focus(); }}
        onCancel={() => setLightboxOpen(false)}
        onClick={(event) => { if (event.target === dialogRef.current) setLightboxOpen(false); }}
      >
        <div className="memorial-carousel-lightbox-inner">
          <button type="button" className="memorial-carousel-close" autoFocus onClick={() => setLightboxOpen(false)} aria-label="Close enlarged photo">✕</button>
          {current && <img src={current.src} alt={imageAlt(current, active)} />}
          {current?.caption.trim() && <p>{current.caption}</p>}
          {count > 1 && (
            <div className="memorial-carousel-lightbox-controls">
              <button type="button" onClick={() => select(active - 1)} aria-label="Previous enlarged photo">← Previous</button>
              <button type="button" onClick={() => select(active + 1)} aria-label="Next enlarged photo">Next →</button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
