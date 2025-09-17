import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getSourceDisplayName(sourceType: string, sourceValue: string): { label: string; url?: string } {
  if (sourceType === 'URL') {
    try {
      const url = new URL(sourceValue);
      return {
        label: url.hostname.replace('www.', ''),
        url: sourceValue
      };
    } catch {
      return { label: sourceValue, url: sourceValue };
    }
  }
  
  return { label: `"${sourceValue}"` };
}
