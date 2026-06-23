// ponytail: join de clases sin clsx/tailwind-merge — basta para componer variantes.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
