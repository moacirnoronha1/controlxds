import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Converte texto para LETRA DE FORMA (maiúsculo), preservando acentos. */
export function upper(v: string | null | undefined): string {
  return (v ?? "").toString().toLocaleUpperCase("pt-BR");
}
