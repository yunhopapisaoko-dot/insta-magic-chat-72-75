import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Detect if a URL likely points to a video file based on extension
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    return /\.(mp4|webm|mov|m4v|ogg)$/i.test(pathname);
  } catch {
    // Fallback for non-URL strings
    return /\.(mp4|webm|mov|m4v|ogg)$/i.test(url.toLowerCase());
  }
}
