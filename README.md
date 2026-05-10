# Pardes — פרדס

**Live** : https://pardes-ai-chat.vercel.app

Compagnon d'étude juive — agent conversationnel IA dédié au judaïsme. Streaming, multilingue, RAG sur ~14 000 chunks (Tanakh français + hébreu, Talmud français, commentaires rabbiniques, transcripts vidéos), guardrail dur hors-sujet, logs anonymes des conversations.

## Stack

- **Hosting** : Vercel (projet `pardes-ai-chat`, auto-deploy depuis `main`)
- **Frontend** : Next.js 15.5 · React 19 · Tailwind · shadcn/ui · Zustand (persist localStorage), typo Inter + Crimson Pro
- **LLM** : Anthropic — `claude-sonnet-4-6` (chat, streaming SSE) + `claude-haiku-4-5-20251001` (guardrail binaire), prompt caching activé
- **Embeddings** : Voyage AI `voyage-3-large` (1024 dim) + reranker `rerank-2.5` (top-30 → top-8)
- **Vector store** (production) : Upstash Vector
- **Logs conversations** (production) : Upstash Redis
- **Indexer** (one-shot, local) : Python · `pypdf` + `voyageai` + `lancedb` puis migration vers Upstash Vector

## Variables d'environnement

Côté Vercel (Settings → Environment Variables) :

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Claude (chat + guardrail) |
| `VOYAGE_API_KEY` | Embeddings + rerank |
| `UPSTASH_VECTOR_REST_URL` / `UPSTASH_VECTOR_REST_TOKEN` | RAG retrieval |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Logs conversations |
| `ADMIN_TOKEN` | Gating de `/api/admin/conversations` |
| `ANTHROPIC_MAIN_MODEL` (optionnel) | Override du modèle chat |
| `ANTHROPIC_GUARDRAIL_MODEL` (optionnel) | Override du modèle guardrail |
| `VOYAGE_EMBED_MODEL` (optionnel) | Override du modèle d'embedding |
| `VOYAGE_RERANK_MODEL` (optionnel) | Override du reranker |

En local, copier `.env.example` vers `.env.local` et remplir.

## Flow d'une requête `/api/chat`

1. Le client envoie l'historique + un `conversationId` (UUID stable côté navigateur).
2. **Guardrail** Haiku 4.5 classe le dernier message en `on_topic: true|false`.
   - Si hors-sujet → réponse de refus, pas d'appel Sonnet.
3. **Retrieval** : embedding Voyage de la question → top-30 Upstash Vector → rerank Voyage → top-8.
4. **Génération** Sonnet 4.6 : system prompt mis en cache, sources injectées en `<sources>` dans le dernier message user, streaming SSE.
5. **Logging** : à la fin du streaming, la conversation complète est stockée comme valeur d'une clé `conversations:{id}` sur Redis (déterministe avant `controller.close()` pour garantir l'écriture avant que le lambda ne soit recyclé).

## Endpoints admin

`GET /api/admin/conversations?token=<ADMIN_TOKEN>[&list=1|&id=<conversationId>]`

- Sans `list` ni `id` : tous les logs concaténés en `text/plain` (pour téléchargement).
- `list=1` : JSON `{count, ids}` triés par récence.
- `id=<uuid>` : un seul log en `text/plain`.

## Architecture

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   ├── charte/page.tsx                # Charte Éthique publique
│   │   └── api/
│   │       ├── chat/route.ts              # SSE streaming + guardrail + retrieval + log
│   │       └── admin/conversations/route.ts # Export logs (token-gated)
│   ├── components/
│   │   ├── chat-container.tsx             # entry UI
│   │   ├── message.tsx                    # bulle markdown
│   │   └── ui/                            # shadcn primitives
│   └── lib/
│       ├── prompts.ts                     # system + guardrail + refus
│       ├── store.ts                       # Zustand + persist + conversationId stable
│       ├── voyage.ts                      # embed + rerank
│       ├── retrieval.ts                   # Upstash Vector + rerank
│       ├── guardrail.ts                   # Haiku binary classifier
│       ├── log.ts                         # Redis writer + admin readers
│       └── utils.ts                       # cn()
├── scripts/
│   ├── index.py                           # PDF → chunks → embeddings → LanceDB local
│   ├── migrate_to_upstash.py              # LanceDB → Upstash Vector (avec filtre <100 chars)
│   ├── fetch_yt_transcripts.py            # YouTube transcripts pour les vidéos référencées
│   └── requirements.txt
└── data/
    └── pardes.lance/                      # vector store local intermédiaire (gitignored)
```

## Setup local (pour itérer sur le code)

```powershell
cd C:\Users\patri\Shalom\app
copy .env.example .env.local              # remplir les variables
npm install
npm run dev                               # http://localhost:3000
```

L'app fonctionne sans Upstash Vector (retrieval renvoie `[]` silencieusement) et sans Redis (logs no-op avec un warning). Pratique pour itérer sur le prompt sans tout brancher.

## Re-indexer le corpus (rare)

Pipeline complet :

```powershell
cd app\scripts
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd ..
python scripts\index.py                   # local : PDFs → LanceDB
python scripts\migrate_to_upstash.py      # LanceDB → Upstash Vector
```

Compte ~30 min de wall time et $1-3 d'embeddings Voyage.

## Multilingue

Pas de switcher : Sonnet détecte la langue du dernier message utilisateur et répond dans la même langue (instruction explicite). Hébreu translittéré par défaut, alphabet hébraïque uniquement si l'utilisateur écrit en hébreu.

## Garde-fous

- **Hors-sujet** : refus net via Haiku amont (pas de routage vers Sonnet).
- **Halakha personnelle** : pour les décisions lourdes (mariage, conversion, *guet*, deuil, fin de vie, bioéthique, *niddah* personnelle), Pardes présente les principes mais renvoie à un rabbin sans émettre de *psaq*. Pour les questions encyclopédiques (cacherout, fêtes, vocabulaire, principes), il répond directement.
- **Détresse psychologique** : empathie + orientation vers professionnels.
- **Israël / Palestine, négationnisme** : règles spécifiques dans le system prompt — pas de prise de parti, pas de complaisance avec le négationnisme.

## Sécurité

- `.env.local` et `.admin-token-temp` sont gitignorés.
- Les credentials ne sont jamais exposés au client (tout passe par les Route Handlers Node.js).
- Si une clé fuite (chat, screenshot, push), la rotater immédiatement dans le dashboard du fournisseur (Anthropic, Voyage, Upstash, Vercel).

## Limites connues

- **OCR Talmud** : `pypdf` ne lit pas les dafs scannés. Heureusement le fichier `talmud.pdf` (corpus français complet) compense largement.
- **Pas d'auth utilisateur** : les conversations sont anonymes (UUID navigateur, pas d'IP).
- **Données traitées par services tiers US** : chaque message transite par Anthropic et Voyage avant d'atteindre le stockage Upstash en UE. Voir Charte Éthique §6.
