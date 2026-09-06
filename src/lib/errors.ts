import Anthropic from "@anthropic-ai/sdk";

/**
 * Traduit une panne serveur en phrase française affichable dans le fil.
 *
 * Le public de Pardes n'est pas technique : ni code HTTP, ni pile d'appels —
 * une phrase qui dit ce qui se passe et quoi faire. Le détail technique reste
 * dans les logs Vercel (voir `console.error` côté route).
 */
export function messageErreurFr(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    // Le solde épuisé arrive en 400, au milieu d'autres 400 sans rapport :
    // on le distingue sur le texte renvoyé par l'API.
    if (/credit balance/i.test(String(e.message ?? ""))) {
      return "Le crédit du service est épuisé : Pardes ne peut plus répondre tant qu'il n'a pas été rechargé. Préviens l'administrateur du site.";
    }

    switch (e.status) {
      case 401:
      case 403:
        return "Pardes n'arrive pas à s'authentifier auprès du service (clé d'accès absente ou invalide). Préviens l'administrateur du site.";
      case 404:
        return "Le modèle configuré est introuvable. Préviens l'administrateur du site.";
      case 429:
        return "Trop de questions en même temps. Attends quelques secondes et réessaie.";
      case 503:
      case 529:
        return "Le service est momentanément surchargé. Réessaie dans un instant.";
    }

    if (typeof e.status === "number" && e.status >= 500) {
      return "Le service a rencontré une erreur temporaire. Réessaie dans un instant.";
    }
    return "Pardes n'a pas pu formuler de réponse. Réessaie dans un instant.";
  }

  if (e instanceof Anthropic.AnthropicError) {
    // Erreurs levées par le SDK avant tout appel réseau — typiquement
    // ANTHROPIC_API_KEY absente au moment de construire le client.
    return "Pardes n'est pas configuré correctement (clé d'accès manquante). Préviens l'administrateur du site.";
  }

  return "Pardes n'a pas pu répondre. Réessaie dans un instant.";
}
