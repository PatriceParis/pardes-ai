import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Charte Éthique — Pardes",
  description:
    "Intention, limites, sources et usage responsable de l'agent IA Pardes.",
};

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
        <article className="prose prose-sm prose-invert max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-h2:mt-10 prose-h2:mb-3 prose-em:font-serif">
          <section>
            <h2>1. Intention du projet</h2>
            <p>
              Cet agent IA a pour but de fournir une <strong>information générale sur le judaïsme</strong>, de manière respectueuse et pédagogique.
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
                Pour toute question pratique de loi juive (<em>Halakha</em>) ou de situation personnelle, l'utilisateur doit consulter <strong>un rabbin ou une autorité compétente</strong>.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Respect de la tradition juive</h2>
            <ul>
              <li>Le judaïsme est une <strong>tradition vivante</strong> portée par des personnes et des communautés réelles.</li>
              <li>L'agent s'engage à présenter les croyances, pratiques et textes juifs avec respect, sans moquerie, dénigrement ni caricature.</li>
              <li>
                En cas de désaccords internes au judaïsme, l'agent s'efforce de présenter <strong>plusieurs points de vue</strong> de façon neutre (par exemple : orthodoxe, massorti, libéral).
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Sources et transparence</h2>
            <ul>
              <li>Les réponses s'appuient autant que possible sur des <strong>sources juives identifiables</strong> : textes classiques (Tanakh, Talmud, Midrash, codes halakhiques), travaux de chercheurs, institutions ou rabbins reconnus.</li>
              <li>
                Quand une question dépasse le champ d'un simple résumé, l'agent privilégie des <strong>formulations prudentes</strong> (« il existe plusieurs avis », « selon telle école ») et renvoie vers des ressources complémentaires.
              </li>
              <li>
                L'agent précise qu'il s'agit d'une <strong>intelligence artificielle, créée par une personne non juive</strong>, et non d'une entité religieuse ou d'un porte‑parole officiel d'une institution juive.
              </li>
            </ul>
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
            <h2>6. Conservation des conversations</h2>
            <ul>
              <li>
                Les conversations sont <strong>enregistrées de manière anonyme</strong> sous forme de fichiers texte, à des fins d'amélioration du service (qualité des réponses, détection d'erreurs, ajustement du périmètre).
              </li>
              <li>
                <strong>Aucune donnée personnelle</strong> n'est associée : pas d'adresse IP, pas d'identifiant utilisateur, pas de cookie de tracking. Seul un identifiant aléatoire (UUID) généré par ton navigateur est utilisé pour regrouper les messages d'une même conversation.
              </li>
              <li>
                Les logs sont stockés sur Vercel Blob, accessibles uniquement par le concepteur du projet.
              </li>
              <li>
                Tu peux demander la suppression d'une conversation en communiquant son identifiant (visible dans le stockage local de ton navigateur, clé <code>pardes-chat</code>).
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
