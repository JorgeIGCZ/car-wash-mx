"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type LightboxPhoto = {
  id: number;
  url: string;
  width: number;
  height: number;
};

type PhotoLightboxProps = {
  photos: LightboxPhoto[];
  startIndex: number;
  title: string;
  onClose: () => void;
};

export function PhotoLightbox({
  photos,
  startIndex,
  title,
  onClose,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const goTo = useCallback(
    (next: number) => {
      setIndex((next + photos.length) % photos.length);
    },
    [photos.length],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goTo, index, onClose]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, fotografía ${index + 1} de ${photos.length}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) < 45 || photos.length < 2) return;
        goTo(delta > 0 ? index - 1 : index + 1);
      }}
    >
      <header className="photo-lightbox-bar">
        <span>
          {title} · {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Cerrar visor de fotografías"
        >
          <X size={22} />
        </button>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element -- URLs firmadas de R2 con vigencia corta; next/image no aporta aquí. */}
      <img
        src={photo.url}
        alt={`Fotografía ${index + 1} de ${photos.length}`}
        width={photo.width}
        height={photo.height}
        draggable={false}
      />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="photo-lightbox-nav prev"
            onClick={() => goTo(index - 1)}
            aria-label="Fotografía anterior"
          >
            <ChevronLeft size={30} />
          </button>
          <button
            type="button"
            className="photo-lightbox-nav next"
            onClick={() => goTo(index + 1)}
            aria-label="Fotografía siguiente"
          >
            <ChevronRight size={30} />
          </button>
          <div className="photo-lightbox-dots" aria-hidden="true">
            {photos.map((item, dotIndex) => (
              <span
                key={item.id}
                className={dotIndex === index ? "active" : ""}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
