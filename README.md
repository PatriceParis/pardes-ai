# Pardes — פרדס

Compagnon d'étude juive — IA conversationnelle dédiée au judaïsme, avec RAG sur un corpus de 6 372 PDFs (Torah, Neviim, Ketouvim, Talmud), guardrail dur hors-sujet, multilingue.

## Stack

- **Frontend** : Next.js 15 (App Router) · React 19 · Tailwind · shadcn/ui · Zustand (persist localStorage)
- **LLM** : Anthropic Claude Sonnet 4.6 (réponse) + Haiku 4.5 (guardrail), streaming SSE, prompt caching activé
- **Embeddings** : Voyage AI `voyage-3.5` (1024-dim)
- **Vector store** : LanceDB embarqué (fichier local, pas de serveur)
- **Indexer** : Python (`pypdf` + `voyageai` + `lancedb`)

## Setup

### 1. Clés API → `.env.local`

```powershell
cd C:\Users\patri\Shalom\app
copy .env.example .env.local
```

Édite `.env.local` :

```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
```

> ⚠️ **Ne jamais commiter `.env.local`** (déjà dans `.gitignore`). Si une clé fuite (chat, log, capture), révoque-la et recrée-la.

### 2. Dépendances Node

```powershell
npm install
```

### 3. Indexer le corpus (one-shot, long)

Voir `scripts/README.md`. En résumé :

```powershell
cd scripts
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd ..
python scripts\index.py
```

Compte 4–12 h et $20–60 d'embeddings. Le script est **résumable** : relance après un crash, il reprend où il en était.

### 4. Lancer l'app

```powershell
npm run dev
```

→ http://localhost:3000

L'app fonctionne **sans le RAG** (le retrieval se dégrade silencieusement si LanceDB est absent ou vide). Tu peux donc tester l'agent + le guardrail avant de lancer l'indexation.

## Architecture

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   └── api/chat/route.ts        # SSE streaming, guardrail → retrieval → Claude
│   ├── components/
│   │   ├── chat-container.tsx       # entry point UI
│   │   ├── message.tsx              # markdown bubble
│   │   ├── source-badge.tsx         # citation chips
│   │   └── ui/                      # shadcn primitives
│   └── lib/
│       ├── prompts.ts               # system prompt + guardrail prompt + refus
│       ├── store.ts                 # Zustand + persist
│       ├── voyage.ts                # embeddings client
│       ├── retrieval.ts             # LanceDB top-k + format <sources>
│       ├── guardrail.ts             # Haiku binary classifier
│       └── utils.ts                 # cn()
├── scripts/
│   ├── index.py                     # PDF → chunks → embeddings → LanceDB
│   └── requirements.txt
└── data/
    └── pardes.lance/                # vector store (créé par l'indexer)
```

## Flow d'une requête

1. UI envoie `POST /api/chat` avec l'historique complet.
2. **Guardrail** (Haiku 4.5) classe le dernier message : *judaïsme* ou *hors-sujet*.
   - Hors-sujet → réponse de refus immédiate, pas d'appel Sonnet.
3. **Retrieval** : embed la question (Voyage) → top-8 LanceDB (cosine).
4. **Génération** (Sonnet 4.6) : system prompt mis en cache, sources injectées en `<sources>` dans le dernier message user, streaming SSE token-by-token.
5. UI : bulles markdown + chips de citations cliquables.

## Multilingue

Pas de switcher : Sonnet détecte la langue du message et répond dans la même langue (instruction explicite dans le system prompt). Hébreu translittéré par défaut, hébreu en alphabet hébraïque seulement si l'utilisateur écrit en hébreu.

## Garde-fous

- **Hors-sujet** : refus dur via classifier Haiku amont.
- **Décisions halakhiques personnelles** : présentation des positions des courants, pas de *psaq*, renvoi à un rabbin.
- **Détresse psychologique** : empathie + orientation vers professionnels (instruction system prompt).
- **Israël/Palestine, négationnisme** : règles spécifiques dans le system prompt.

## Sécurité des clés

- `.env.local` est gitignoré.
- Les clés ne sont jamais exposées au client (tout passe par les Route Handlers Node).
- Si une clé est partagée par erreur (chat, screenshot, push), **rotate-la immédiatement** dans le dashboard du fournisseur.

## Limites connues

- L'extraction PDF avec `pypdf` peut échouer sur les scans (pas d'OCR). Pour les Talmuds scannés, prévoir un fallback `pdfplumber` ou Tesseract — non implémenté pour le MVP.
- Le retrieval ne reranke pas (pas de Voyage rerank). Acceptable au top-8 ; à ajouter si la précision baisse.
- Pas d'auth ni de persistance serveur — tout est en `localStorage`.
