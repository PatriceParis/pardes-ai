import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * Client Anthropic partagé, construit à la première utilisation.
 *
 * Volontairement paresseux : `new Anthropic()` lève si ANTHROPIC_API_KEY est
 * absente. Construit au niveau module, cette exception casse le chargement de
 * la route entière — Next renvoie alors un 500 opaque et l'utilisateur ne voit
 * aucun message. En différant la construction, l'erreur remonte dans le
 * try/catch de la route et devient une phrase lisible.
 */
export function anthropic(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}
