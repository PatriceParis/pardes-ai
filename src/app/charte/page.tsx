import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Charte Éthique — Pardes",
  description:
    "Intention, limites, sources et usage responsable de l'agent IA Pardes.",
};

const CHARTER_VERSION = "0.2";
const CHARTER_LAST_UPDATED = "10 mai 2026";

export default function ChartePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="font-serif text-xl tracking-tight">Charte Éthique</h1>
            <p className="text-xs text-muted-foreground">
              <span className="font-serif italic">פרדס</span> — Pardes
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour à l'étude
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs">
          <span className="font-medium text-primary">Beta · MVP</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            Version {CHARTER_VERSION} — mise à jour le {CHARTER_LAST_UPDATED}
          </span>
        </div>

        <article className="prose prose-sm prose-invert max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h2:mt-10 prose-h2:mb-3 prose-em:font-serif">
          <section>
            <h2>1. Intention du projet</h2>
            <p>
              Cet agent IA a pour but de fournir une <strong>information générale sur le judaïsme</strong>, de manière respectueuse et pédagogique.
            </p>
            <p>
              Pardes est en <strong>phase de test (MVP)</strong> et n'a pas encore été relu ou validé par des autorités rabbiniques ou des chercheurs en études juives. Ses réponses peuvent contenir des erreurs ou des approximations.
            </p>
            <p>
              Il ne cherche pas à se substituer à l'étude personnelle ni à la relation avec des enseignants, rabbins ou communautés juives.
            </p>
          </section>

          <section>
            <h2>2. Positionnement et limites</h2>
            <ul>
              <li>L'agent <strong>n'est pas un rabbin</strong>, ni une autorité religieuse, ni un guide spirituel.</li>
              <li>Ses réponses peuvent être <strong>incomplètes ou contenir des erreurs</strong> : elles ne doivent pas servir de base à des décisions religieuses, juridiques ou personnelles importantes.</li>
              <li>
                Pour toute <strong>décision personnelle qui engage</strong> la vie de l'utilisateur (mariage, conversion, divorce religieux, deuil, fin de vie, choix bioéthiques, ou cas halakhique complexe propre à sa situation), il revient à <strong>un rabbin ou une autorité compétente</strong> de trancher. L'agent peut expliquer les principes généraux, mais n'émet pas de <em>psaq</em> (décision halakhique personnelle).
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Respect de la tradition juive</h2>
            <ul>
              <li>Le judaïsme est une <strong>tradition vivante</strong> portée par des personnes et des communautés réelles.</li>
              <li>L'agent s'engage à présenter les croyances, pratiques et textes juifs avec respect, sans moquerie, dénigrement ni caricature.</li>
              <li>
                En cas de désaccords internes au judaïsme, l'agent s'efforce de présenter <strong>plusieurs points de vue</strong> de façon neutre (par exemple : orthodoxe, massorti, libéral, reconstructionniste).
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Sources et transparence</h2>
            <p>
              Les réponses sont <strong>ancrées dans un corpus indexé</strong> (~14 000 extraits) qui inclut :
            </p>
            <ul>
              <li>Le <strong>Tanakh</strong> en français et en hébreu (Torah, Neviim, Ketouvim) ;</li>
              <li>Le <strong>Talmud</strong> en traduction française complète, plus des références ponctuelles à des dafs ;</li>
              <li>Des <strong>commentaires rabbiniques</strong> (notamment <em>À l'écoute de la Thora</em>) ;</li>
              <li>Des <strong>transcripts de conférences vidéo</strong> publiques (Rabbi Jonathan Sacks z'l, fondamentaux du judaïsme) ;</li>
              <li>Des <strong>synthèses académiques</strong> sur l'architecture textuelle et les courants du judaïsme.</li>
            </ul>
            <p>
              Quand une question dépasse le champ d'un simple résumé, l'agent privilégie des <strong>formulations prudentes</strong> (« il existe plusieurs avis », « selon telle école ») plutôt que de trancher.
            </p>
            <p>
              <strong>Transparence sur la conception</strong> : Pardes est une intelligence artificielle, créée par une <strong>personne non juive</strong>, et non une entité religieuse ou un porte-parole officiel d'une institution juive. Modèles utilisés : Claude Sonnet 4.6 et Haiku 4.5 (Anthropic, États-Unis), embeddings et recherche sémantique par Voyage AI <em>voyage-3-large</em> et reranker <em>rerank-2.5</em> (Voyage AI, États-Unis).
            </p>
          </section>

          <section>
            <h2>5. Usage responsable</h2>
            <p>L'agent <strong>ne doit pas</strong> être utilisé pour :</p>
            <ul>
              <li>délivrer des verdicts religieux (<em>psaq</em>) ;</li>
              <li>conseiller sur des conversions, divorces religieux (<em>guet</em>), litiges communautaires ou familiaux ;</li>
              <li>alimenter des polémiques, discours haineux ou contenus antisémites.</li>
            </ul>
            <p>
              Toute utilisation visant à dénigrer des personnes juives, le judaïsme ou d'autres religions est en contradiction avec l'esprit de cet outil.
            </p>
          </section>

          <section>
            <h2>6. Conservation des conversations et flux de données</h2>
            <p>
              Les conversations sont <strong>enregistrées de manière anonyme</strong> à des fins d'amélioration du service (qualité des réponses, détection d'erreurs, ajustement du périmètre).
            </p>
            <ul>
              <li>
                <strong>Aucune donnée personnelle</strong> n'est associée : pas d'adresse IP collectée, pas d'identifiant utilisateur, pas de cookie de tracking. Seul un identifiant aléatoire (UUID) généré par ton navigateur est utilisé pour regrouper les messages d'une même conversation, et reste stocké uniquement dans le <em>localStorage</em> de ton navigateur (clé <code>pardes-chat</code>).
              </li>
              <li>
                <strong>Flux de traitement</strong> : avant d'être stockés, chaque message transite par les services d'<strong>Anthropic</strong> (génération de la réponse, États-Unis) et de <strong>Voyage AI</strong> (recherche sémantique dans le corpus, États-Unis). Anthropic peut conserver les requêtes jusqu'à 30 jours pour la modération de contenu abusif. Voyage AI ne stocke pas les requêtes selon sa politique. Voir leurs documentations respectives.
              </li>
              <li>
                <strong>Stockage final</strong> : les conversations sont enregistrées chiffrées sur Upstash Redis, en région UE (Europe de l'Ouest), accès protégé par un token administrateur connu uniquement du concepteur du projet.
              </li>
              <li>
                <strong>Suppression sur demande</strong> : tu peux demander la suppression d'une conversation en communiquant son identifiant (visible dans le <em>localStorage</em> de ton navigateur, clé <code>pardes-chat</code>). Pendant la phase MVP, le canal de demande est l'ouverture d'une issue sur le repo public du projet (<a href="https://github.com/PatriceParis/pardes-ai/issues" target="_blank" rel="noreferrer">github.com/PatriceParis/pardes-ai</a>) ou tout autre contact direct avec le concepteur.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. Évolution et révision</h2>
            <p>
              Cette charte est <strong>évolutive</strong> : elle pourra être ajustée à mesure que le projet mûrit, à la lumière des retours d'utilisateurs et, idéalement, de personnes juives (enseignants, rabbins, chercheurs).
            </p>
            <p>
              En cas de doute éthique sur une fonctionnalité ou un contenu, la <strong>prudence</strong>, le <strong>respect des personnes</strong> et l'<strong>honnêteté sur les limites de l'IA</strong> priment.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
