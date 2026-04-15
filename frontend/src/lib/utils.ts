import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISOUTC } from "./timezone"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date) {
  if (!dateString) return '';
  const date = parseISOUTC(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | Date) {
  if (!dateString) return '';
  const date = parseISOUTC(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}
