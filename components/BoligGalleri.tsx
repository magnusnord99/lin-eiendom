"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, X, ChevronLeft, ChevronRight } from "lucide-react";

interface BoligGalleriProps {
  bilder: string[];
  tittel: string;
}

export default function BoligGalleri({ bilder, tittel }: BoligGalleriProps) {
  const [valgt, setValgt] = useState(0);
  const [lysboks, setLysboks] = useState(false);

  if (bilder.length === 0) {
    return (
      <div className="aspect-[16/9] bg-[var(--surface)] rounded-xl border border-[var(--border)] flex items-center justify-center">
        <div className="text-center text-[var(--muted)]">
          <ImageOff className="w-14 h-14 mx-auto mb-3 opacity-25" strokeWidth={1} />
          <p className="text-sm">Ingen bilder</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Hovedbilde */}
        <div
          className="aspect-[16/9] relative rounded-xl overflow-hidden cursor-pointer bg-[var(--surface)]"
          onClick={() => setLysboks(true)}
        >
          <Image src={bilder[valgt]} alt={`${tittel} - bilde ${valgt + 1}`} fill className="object-cover hover:scale-105 transition-transform duration-300" />
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {valgt + 1} / {bilder.length}
          </div>
        </div>

        {/* Thumbnails */}
        {bilder.length > 1 && (
          <div className="grid grid-cols-5 gap-2">
            {bilder.map((bilde, i) => (
              <button
                key={i}
                onClick={() => setValgt(i)}
                className={`aspect-square relative rounded-lg overflow-hidden border-2 transition-all ${
                  i === valgt ? "border-[var(--primary)]" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={bilde} alt={`Thumbnail ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lysboks */}
      {lysboks && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLysboks(false)}
        >
          <div className="relative max-w-4xl w-full aspect-[16/9]" onClick={(e) => e.stopPropagation()}>
            <Image src={bilder[valgt]} alt={tittel} fill className="object-contain" />
          </div>
          <button
            className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center"
            onClick={() => setLysboks(false)}
          >
            <X className="w-5 h-5" />
          </button>
          {bilder.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center"
                onClick={() => setValgt((valgt - 1 + bilder.length) % bilder.length)}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center"
                onClick={() => setValgt((valgt + 1) % bilder.length)}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
