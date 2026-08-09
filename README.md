# NEXUS Multi-Agent AI Orchestration

> A production-ready multi-agent AI orchestration system with specialized agents for architecture, coding, security review, and documentation. Inspired by AnythingLLM.

## ✨ Features

- **Five Specialized AI Agents** — Architect (planning), Forge (coding), Sentinel (security review), Perception (multimodal/MCP), and Scribe (documentation)
- **Three Debate Modes** — Fast (Architect only), Council (full pipeline with arbitration), and Red Team (adversarial review)
- **Multi-Provider Support** — OpenAI, Anthropic, Google AI, Mistral, Groq, Together, Ollama, LM Studio, vLLM, LlamaCPP, KoboldCPP, and custom endpoints
- **Workspace Management** — Upload, view, edit, and organize codebase files for the NEXUS council to work with
- **Knowledge Base** — Document upload with RAG configuration (chunk size, overlap, top-K, similarity threshold)
- **MCP Server Integration** — Connect external Model Context Protocol servers for extended tool capabilities
- **Built-in Tool System** — 12 tools across categories: Information, Filesystem, DevOps, System, Quality, Perception, Data, and Knowledge
- **Cost Tracking** — Per-session and per-agent token/cost monitoring with configurable budget limits
- **Dark/Light Theme** — Full theme support with violet-accented design system
- **Responsive Design** — Mobile-first layout with collapsible sidebar and adaptive components

## 🏗 Architecture

```
NEXUS uses a layered architecture:

┌───────────────────────────────────────────────┐
│                 Next.js 16 App Router         │
│              (React 19 + TypeScript 5)        │
├───────────────────────────────────────────────┤
│                  UI Layer                      │
│   shadcn/ui + Tailwind CSS 4 + Framer Motion  │
├───────────────────────────────────────────────┤
│              State Management                  │
│        Zustand (chat, UI, providers, agents)   │
├───────────────────────────────────────────────┤
│               API Routes                       │
│    Chat · Providers · Agents · Documents ·     │
│    Sessions · Settings · Workspace · MCP       │
├───────────────────────────────────────────────┤
│               Data Layer                       │
│         Prisma ORM + SQLite                    │
└───────────────────────────────────────────────┘
```

## 🤖 Agent Council

| Agent      | Role              | Description                                                           |
| ---------- | ----------------- | --------------------------------------------------------------------- |
| Architect  | Planner           | Analyzes requirements, decomposes tasks, and arbitrates debate       |
| Forge      | Coder             | Generates implementation code with proper patterns and error handling |
| Sentinel   | Security Reviewer | Reviews code for vulnerabilities and quality issues                   |
| Perception | Multimodal        | Handles OCR, vision analysis, audio, and database queries            |
| Scribe     | Documentation     | Creates and maintains documentation and summaries                      |

### Debate Modes

1. **Fast** — Only Architect responds with a plan (quick iteration)
2. **Council** — Architect → Forge → Sentinel → Architect arbitration (full pipeline)
3. **Red Team** — Same as Council but Sentinel performs aggressive adversarial review

## 📁 Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema (7 models)
├── src/
│   ├── app/
│   │   ├── api/               # API routes (backend)
│   │   │   ├── agents/         # Agent CRUD + reset
│   │   │   ├── chat/           # Chat sessions, messages, orchestration
│   │   │   ├── documents/      # Document upload
│   │   │   ├── mcp-servers/    # MCP server management
│   │   │   ├── providers/      # LLM provider CRUD + model probing
│   │   │   ├── settings/       # App settings
│   │   │   └── workspace/      # Codebase file management
│   │   ├── globals.css        # Tailwind v4 theme
│   │   ├── layout.tsx         # Root layout with ThemeProvider
│   │   ├── page.tsx           # Main page (sidebar + header + view router)
│   │   └── error.tsx          # Global error boundary
│   ├── components/
│   │   ├── chat/             # Chat panel (messages, input, debate timeline)
│   │   ├── layout/           # Sidebar, header, view router
│   │   ├── agents/           # Agent roster/editor
│   │   ├── providers/        # Provider manager with 2-step wizard
│   │   ├── knowledge/        # Knowledge base with RAG config
│   │   ├── tools/            # Tool toggles + MCP server management
│   │   ├── workspace/        # Codebase workspace browser
│   │   ├── settings/         # Settings panel
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts             # Prisma client singleton
│   │   ├── types.ts          # TypeScript type definitions
│   │   ├── constants.ts      # Provider/agent/tool/debate definitions
│   │   ├── utils.ts          # Utility functions (cn, etc.)
│   │   ├── url-validator.ts  # SSRF protection + provider type validation
│   │   └── provider-fetch.ts # Shared model fetching (deduplicated)
│   ├── stores/
│   │   ├── chat-store.ts    # Chat sessions, messages, sending
│   │   ├── ui-store.ts       # UI state (view, sidebar, debate mode)
│   │   ├── provider-store.ts # Provider CRUD + testing
│   │   └── agent-store.ts    # Agent configs + auto-seed
│   └── hooks/
│       ├── use-mobile.ts    # Mobile breakpoint detection
│       └── use-toast.ts      # Toast notifications (legacy)
├── workspace/                    # User-uploaded codebase files
├── .env.example                  # Environment variable template
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nexus

# Install dependencies
npm install
# or bun install

# Set up environment variables
cp .env.example .env
# The default SQLite database path is file:./db/dev.db

# Start the development server
npm run dev
# or bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Management

```bash
# Push schema changes to the database (runs automatically on install)
npm run db:push

# Generate Prisma client
npm run db:generate

# Reset the database (destructive)
npm run db:reset
```

## 🔧 Configuration

### Environment Variables

| Variable                | Default               | Description                              |
| ----------------------- | --------------------- | ---------------------------------------- |
| `DATABASE_URL`          | `file:./db/dev.db`   | SQLite database connection string       |
| `NEXUS_ENCRYPTION_KEY`  | *(none)*             | Key for encrypting API keys at rest     |
| `PORT`                  | `3000`               | Development server port                 |

### LLM Providers

1. Navigate to **Providers** in the sidebar
2. Click **Add Provider**
3. Enter connection details (name, type, base URL, API key)
4. Select models from the auto-detected list
5. Configure agents to use the provider in **Agents**

### Agent Configuration

Each agent can be configured with:

- A specific LLM provider and model
- Custom system prompt
- Temperature and max tokens
- Allowed tools

### Workspace

The workspace feature allows you to:

- **Upload files** — Drag and drop or use the upload button
- **Create folders** — Organize your codebase
- **View & edit files** — Click any file to view its content
- **Delete files** — Remove files from the workspace

Files in the workspace are stored in the `workspace/` directory on the server.

## 🛡 Security

- **SSRF Protection** — All provider URLs are validated against private IP ranges and localhost
- **Input Validation** — Provider types are validated against an allowlist
- **File Size Limits** — Document uploads limited to 10MB, workspace uploads to 50MB
- **Path Traversal Protection** — Workspace API blocks directory traversal attacks
- **Settings Key Allowlist** — Only known setting keys can be written
- **Cascade Delete** — Database relations use proper cascade policies

## 📊 Tech Stack

| Category       | Technology                                      |
| -------------- | ----------------------------------------------- |
| Framework      | Next.js 16 (App Router, React 19)                |
| Language       | TypeScript 5                                    |
| Styling        | Tailwind CSS 4 + shadcn/ui                      |
| Database       | Prisma ORM + SQLite                             |
| State          | Zustand                                          |
| Animations     | Framer Motion                                    |
| Icons          | Lucide React                                     |
| Theme          | next-themes (dark/light)                         |
| Markdown       | react-markdown + react-syntax-highlighter        |

## 📝 License

MIT
