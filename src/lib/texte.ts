/** Coupe un texte sans casser un émoji en deux (un demi-émoji rend le JSON invalide pour certains lecteurs). */
export function coupe(s: string, n: number): string {
  const c = Array.from(s);
  return c.length <= n ? s : c.slice(0, n).join("");
}
