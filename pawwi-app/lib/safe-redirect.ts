// Solo acepta paths relativos internos ("/booking/nuevo?x=1") — bloquea
// "//evil.com", "/\evil.com" (algunos navegadores leen \ como /) y URLs
// absolutas para evitar open-redirect vía ?next=.
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    value[1] !== "/" &&
    value[1] !== "\\"
  ) {
    return value;
  }
  return fallback;
}
