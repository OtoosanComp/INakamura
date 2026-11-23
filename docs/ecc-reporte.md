# Reporte: Everything Claude Code (ECC) — cómo instalarlo en el proyecto

- Repo: https://github.com/affaan-m/ECC (clon superficial en `(clon temporal)`)
- Commit revisado: `4adeee6732a12d1540f49a4d50a38ce8c97f9a53` (versión 2.2.3)
- Licencia: **MIT** (Copyright (c) 2026 Affaan Mustafa). Se puede vendorizar y redistribuir conservando el aviso de copyright y el texto de la licencia (copiar `LICENSE` junto al código vendorizado).

## 1. Métodos de instalación oficiales (README)

1. **Plugin marketplace de Claude Code**: `/plugin marketplace add https://github.com/affaan-m/ECC` y luego `/plugin install ecc@ecc`. Usa `.claude-plugin/plugin.json` y `marketplace.json`. Instala TODO (72 agentes, 328 skills, 99 comandos, hooks). Es interactivo (comandos `/plugin`).
2. **Declarativo en settings.json**: `extraKnownMarketplaces: {ecc: {source: {source: "github", repo: "affaan-m/ECC"}}}` + `enabledPlugins: {"ecc@ecc": true}`. Equivale a los dos comandos anteriores.
3. **Asistente npm `npx ecc-universal@2.2.3 setup`** (paquete `ecc-universal`): inventaría alcances, instala/actualiza `ecc@ecc` y permite elegir perfil de hooks. Interactivo; `install --guided ... --yes` lo hace sin preguntas. Descarga código de npm en tiempo de ejecución.
4. **`./install.sh --profile <perfil> --target claude`** (o `install.ps1`, o `npx ecc-universal install ...`): copia selectivamente rules/agents/skills/commands a `~/.claude/` o a destinos de otros harness (Cursor, Codex, etc.). Perfiles en `manifests/install-profiles.json`: `minimal` (sin hooks), `core`, `developer`, `security`, `research` (contenido/investigación), `full`. Opciones: `--skills a,b`, `--without baseline:hooks`, `--no-hooks`, `--modules`, `--dry-run`.
5. **Copia manual**: copiar carpetas de `skills/` (directamente bajo `~/.claude/skills/` o `.claude/skills/`; NO anidar en subcarpeta `ecc/`), `agents/`, `rules/common` + un lenguaje. El README advierte: elegir UN solo camino (si se instala el plugin, no correr además `install.sh --profile full`).
6. Otros: Codex marketplace, Cursor, Gemini, OpenCode, Kimi, Copilot, etc. (no relevantes aquí).

## 2. Inventario

| Elemento | Cantidad |
|---|---|
| Skills (`skills/*/SKILL.md`) | **328** (coincide con plugin.json). No existe `.claude/skills/` en el repo |
| Agentes (`agents/*.md`) | 72 |
| Comandos (`commands/*.md`) | 99 (shims heredados) |
| Reglas (`rules/`) | 21 carpetas (common + ~20 lenguajes/frameworks), `common` con 10 archivos |
| Hooks (`hooks/hooks.json`) | 33 entradas en 8 eventos (PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, PreCompact, SessionStart, Stop, SessionEnd), apoyadas en 64 scripts en `scripts/hooks/` |
| Tamaño de `skills/` en disco | 8.2 MB |
| Copias duplicadas de skills en el repo | docs/ja-JP, docs/zh-CN, `.agents/skills` (49), `.kiro/skills`, `pi/core/skills` (138)… (ignorar; el repo completo pesa bastante más) |

**Costo de contexto de descripciones**: suma de `name`+`description` de las 328 skills = 106,911 caracteres ≈ **26,700 tokens** por sesión si TODAS estuvieran activas (más agentes/comandos si se instala el plugin completo). Las 15 skills recomendadas abajo suman ≈ **1,200 tokens**.

## 3. Revisión de seguridad

**Hooks (`hooks/hooks.json`)**: todos ejecutan `node -e "..."` que resuelve `CLAUDE_PLUGIN_ROOT` (o `~/.claude/...`) y lanza scripts locales de `scripts/hooks/` mediante `run-with-flags.js`. Todo requiere **Node** (en el contenedor hay v22; OK). Lo que hacen, en resumen:
- PreToolUse: dispatchers de Bash (bloqueo de `--no-verify`, calidad de commit, recordatorio de push/tmux, bloqueo de dev servers), `config-protection`, `gateguard-fact-force` (obliga a "verificar hechos" antes de editar; **puede ser molesto/fricción**), checks de MCP (`mcp-health-check`), avisos de docs.
- PostToolUse: formateo/typecheck tras editar (usa `node_modules/.bin` local o `npx`), registro de comandos, métricas, `observe` (aprendizaje continuo).
- SessionStart/End, Stop, PreCompact: guardan estado de sesión, costos (`~/.claude/metrics/costs.jsonl`), resúmenes y notificaciones de escritorio (`desktop-notify`; no aplica en contenedor).
- **Red**: `grep` encuentra `http/https` solo en `mcp-health-check.js` (comprueba salud de servidores MCP ya configurados, incluidos los HTTP) y `plan-canvas-pending.js` (solo loopback/localhost). No se encontró telemetría saliente a servidores del autor en los hooks. Sin `curl`, sin `npm install` en hooks (solo `npx` de formateadores locales si falta binario local).
- **Escritura fuera del proyecto**: los hooks escriben estado/métricas en `~/.claude/` (sesiones, costos, homunculus). No modifican `settings.json` por sí mismos; `ecc-statusline` es opcional y se registra aparte. En un contenedor efímero ese estado se pierde (sin daño).
- **API keys**: ningún hook obligatorio las pide. `insaits-security-monitor.py` es **opt-in** (`ECC_ENABLE_INSAITS=1`) y usaría un SDK/servicio externo de terceros (InsAIts); desactivado por defecto.

**Banderas / precauciones**
1. **Plugin completo = superficie grande**: 33 hooks que se ejecutan en cada herramienta, 72 agentes y 99 comandos. Ejecuta código arbitrario del repo en cada sesión (por eso conviene fijar commit). Recomendado NO activar hooks.
2. **`npx ecc-universal@...setup/install`** descarga y ejecuta código desde npm; el propio README dice que fijar versión "no es una auditoría". Evitar en el flujo automático; preferir copia desde el commit fijado.
3. **`.mcp.json`** (raíz del repo) agrega un único servidor: `chrome-devtools` (`npx -y chrome-devtools-mcp@1.10.1`). No requiere API key, pero necesita navegador Chrome y descarga por npx; en contenedor probablemente inútil. El `plugin.json` declara `"mcpServers": {}` (vacío). `mcp-configs/` contiene catálogos de ejemplo (GitHub, Exa, fal, etc., con tokens) que NO se activan solos.
4. Skills que requieren claves/servicios externos (no activarlas sin necesidad): `social-publisher` (SocialClaw, SC_API_KEY, servicio de terceros), `fal-ai-media` (FAL_KEY), `videodb` (VIDEO_DB_API_KEY), `exa-search` (EXA_API_KEY), `x-api`, `lead-intelligence` (Apollo/Exa/X), `messages-ops` (lee SMS/DMs), `agent-payment-x402` y `roundhouse-x402` (pagos de agentes: **no activar**).
5. No encontré en `.claude-plugin/` nada que modifique `~/.claude/settings.json` automáticamente; sí lo hace el asistente `setup`/`install.sh` (escribe en `~/.claude/` y `ecc-install-state`). Otro motivo para la copia manual.
6. El repo trae directorios `.codex`, `.cursor`, `.gemini`, `.kiro`, etc. y `ecc2/` (binario Rust de control): irrelevantes; si se vendoriza completo, ocupan espacio.

## 4. Recomendación para este caso (sesiones cloud efímeras, sin PC)

**Layout propuesto**
- (a) **Vendorizar** ECC fijado a `4adeee6732a12d1540f49a4d50a38ce8c97f9a53` en `herramientas/ecc/` (sin `.git`; conservar `LICENSE`, `skills/`, `agents/`, `rules/`, `commands/`, `manifests/`, `hooks/`, `scripts/`, `.claude-plugin/`; se pueden omitir `docs/` traducidos, `.codex/.cursor/...`, `ecc2/`, `tests/`). Anotar el commit en `herramientas/ecc/PIN.txt`.
- (b) **Activar un subconjunto** copiando carpetas de `herramientas/ecc/skills/<nombre>` a `.claude/skills/<nombre>` (Claude Code carga skills de hijos directos de `.claude/skills/` del proyecto; funciona en sesiones cloud porque viven en el repo, sin instalar nada). Sin hooks, sin agentes, sin comandos.
- (c) **Script `herramientas/ecc-activar.sh`**: `ecc-activar.sh` sin argumentos = lista curada; `ecc-activar.sh todas` = las 328; `ecc-activar.sh a b c` = nombres concretos; `--listar` muestra disponibles. Debe hacer `cp -r` desde `herramientas/ecc/skills/` y rechazar nombres con `/` o `..`. Idempotente, sin red.
- (d) Opcional: `rules/common` a `.claude/rules/` (pesa contexto; solo si se desea).

**¿Funciona `extraKnownMarketplaces` + `enabledPlugins` en `.claude/settings.json` del proyecto en cloud?** Probablemente sí en principio (el marketplace se declara por repositorio GitHub y Claude Code puede resolverlo), pero con desventajas: (1) depende de acceso de red a github.com y del proxy del contenedor en cada sesión nueva (clonado/caché en cada contenedor efímero, arranque más lento); (2) en modo no interactivo puede pedir confianza/aprobación del marketplace y del plugin; (3) sigue la rama por defecto de ECC, **no queda fijado a un commit** (riesgo de cadena de suministro: cualquier cambio futuro se ejecuta en tus sesiones); (4) activa el paquete completo: 328 skills + 72 agentes + 99 comandos + 33 hooks (≈27k+ tokens de descripciones y mucha fricción, p. ej. gateguard); (5) no se pudo probar aquí. Por eso se recomienda vendorizar + copiar subconjunto; la declaración de marketplace puede añadirse después como opción, no como base.

## 5. Lista recomendada (15 skills, ≈1,200 tokens de descripciones, ≈270 KB en disco)

Origen común: `herramientas/ecc/skills/<nombre>` (equivale a `skills/<nombre>` en el repo ECC). Destino: `.claude/skills/<nombre>`.

| Skill | Ruta fuente en ECC | Marca |
|---|---|---|
| `article-writing` | `skills/article-writing` | ⭐ |
| `brand-voice` | `skills/brand-voice` | ⭐ |
| `content-engine` | `skills/content-engine` | ⭐ |
| `crosspost` | `skills/crosspost` | ⭐ |
| `video-editing` | `skills/video-editing` | ⭐ |
| `deep-research` | `skills/deep-research` | ⭐ |
| `research-ops` | `skills/research-ops` | ⭐ |
| `market-research` | `skills/market-research` | ⭐ |
| `marketing-campaign` | `skills/marketing-campaign` | ⭐ |
| `short-video-distribution` | `skills/short-video-distribution` | ⭐ |
| `security-review` | `skills/security-review` | 🛠 |
| `git-workflow` | `skills/git-workflow` | 🛠 |
| `conventional-commit-review` | `skills/conventional-commit-review` | 🛠 |
| `python-patterns` | `skills/python-patterns` | 🛠 |
| `verification-loop` | `skills/verification-loop` | 🛠 |

Notas: `video-editing` es la más pesada (80 KB, 13 archivos; usa FFmpeg y menciona ElevenLabs/fal.ai como opcionales). `short-video-distribution` publica en redes solo tras aprobación explícita, pero requiere un proveedor de publicación; se puede quitar si no se usará. **No existe una skill específica de fact-checking ni de redacción en español**: `article-writing`+`brand-voice` (con ejemplos en español) y `deep-research`/`research-ops` (citas y niveles de confianza) son lo más cercano. Sustitutos opcionales: `seo`, `remotion-video-creation`, `manim-video`, `frontend-slides`, `exa-search` (con EXA_API_KEY).

## 6. Catálogo completo de skills (328)

Leyenda: ⭐ relevante para creación de contenido; 🛠 útil para desarrollo en general. Las filas con "(EN)" conservan el resumen original en inglés truncado (no relevantes para este proyecto); las categorías en español agrupan skills de nicho.

| Skill | Resumen | Marca |
|---|---|---|
| `accessibility` | (EN) Design, implement, and audit accessible UI to WCAG 2.2 Level AA across Web, iOS, and Andro |  |
| `agent-architecture-audit` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-eval` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-harness-construction` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-introspection-debugging` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-payment-x402` | Cripto / trading / mercados (nicho) |  |
| `agent-runtime-gateway-smoke-test` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-security-hardening` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-self-evaluation` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agent-sort` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agentic-engineering` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `agentic-os` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `ai-first-engineering` | (EN) Engineering operating model for teams where AI agents generate a large share of implementa |  |
| `ai-regression-testing` | (EN) Regression testing strategies for AI-assisted development. Sandbox-mode API testing withou |  |
| `android-clean-architecture` | Patrones/pruebas de lenguaje o framework de desarrollo (android) |  |
| `angular-developer` | Patrones/pruebas de lenguaje o framework de desarrollo (angular) |  |
| `api-connector-builder` | (EN) Build a new API connector or provider by matching the target repo's existing integration p |  |
| `api-design` | Patrones de diseño de APIs REST | 🛠 |
| `architecture-decision-records` | (EN) Capture architectural decisions as numbered ADR markdown files in docs/adr/ with context,  |  |
| `article-writing` | Redacta artículos, guías, newsletters largos con voz propia derivada de ejemplos | ⭐ |
| `automation-audit-ops` | (EN) Evidence-first automation inventory and overlap audit workflow for ECC. Use when the user  |  |
| `autonomous-agent-harness` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `autonomous-loops` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `backend-patterns` | (EN) Backend architecture patterns, API design, database optimization, and server-side best pra |  |
| `benchmark` | (EN) Measure performance baselines and detect regressions across browser Core Web Vitals (LCP,  |  |
| `benchmark-methodology` | (EN) "Score a scoped competitor set into comparable profile cards: nine weighted dimensions (po |  |
| `benchmark-optimization-loop` | (EN) - Turn a user's improvement goal into a bounded benchmark-guided loop: define success and  |  |
| `bengali-nlp` | (EN) Bengali (Bangla) text processing patterns including Unicode normalization, script detectio |  |
| `blender-motion-state-inspection` | (EN) Inspects Blender characters, rigs, poses, animation retargeting, ground contact, facing di |  |
| `blueprint` | (EN) "Turn a one-line objective into a step-by-step construction plan for multi-session, multi- |  |
| `brand-discovery` | Descubrimiento de marca/identidad | ⭐ |
| `brand-voice` | Construye un perfil de estilo/voz a partir de textos reales y lo reutiliza | ⭐ |
| `brownfield-retrospective` | (EN) Run the ECC engineering process retroactively against an existing project slice. Audit cur |  |
| `browser-qa` | Verificación de UI post-deploy con automatización de navegador | 🛠 |
| `bun-runtime` | Patrones/pruebas de lenguaje o framework de desarrollo (bun) |  |
| `canary-watch` | (EN) Monitors and verifies deployed URLs after releases by checking HTTP endpoints, SSE streams |  |
| `carrier-relationship-management` | Operaciones de negocio/logística (nicho) |  |
| `change-impact` | (EN) - Perform evidence-backed impact analysis before changing code, data, interfaces, or gover |  |
| `cisco-ios-patterns` | Redes / homelab (infraestructura) |  |
| `ck` | (EN) "Persistent per-project memory for Claude Code (Context Keeper) driven by deterministic No |  |
| `click-path-audit` | (EN) "Trace every user-facing button/touchpoint through its full state change sequence to find  |  |
| `clickhouse-io` | Patrones/pruebas de lenguaje o framework de desarrollo (clickhouse) |  |
| `code-tour` | (EN) Create CodeTour `.tour` files — persona-targeted, step-by-step walkthroughs with real file |  |
| `codebase-onboarding` | Onboarding/mapa de un código base nuevo | 🛠 |
| `codehealth-mcp` | (EN) Real-time structural Code Health via CodeScene MCP — review before edits, verify score del |  |
| `coding-standards` | Convenciones generales de código: nombres, legibilidad, inmutabilidad | 🛠 |
| `competitive-platform-analysis` | Análisis competitivo de plataformas | ⭐ |
| `competitive-report-structure` | Estructura de reportes competitivos | ⭐ |
| `compose-multiplatform-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (compose) |  |
| `config-gc` | (EN) Garbage collection for your Claude Code configuration. Periodically scans ~/.claude (skill |  |
| `config-health` | (EN) Runtime configuration integrity monitoring for Claude Code. Detects config drift, rule sta |  |
| `configure-ecc` | (EN) "Run the conversational ECC setup wizard inside the current harness: inventory the install |  |
| `connections-optimizer` | (EN) Reorganize the user's X and LinkedIn network with review-first pruning, add/follow recomme |  |
| `content-engine` | Sistema de contenido nativo por plataforma (X, LinkedIn, TikTok, YouTube): posts, hilos, guiones, calendario | ⭐ |
| `content-hash-cache-pattern` | (EN) Cache expensive file processing results using SHA-256 content hashes — path-independent, a |  |
| `context-and-decisions` | (EN) - Govern stable domain context with a narrowly scoped CONTEXT.md when needed, and route ha |  |
| `context-budget` | Auditoría del presupuesto de contexto | 🛠 |
| `continuous-agent-loop` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `continuous-learning` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `continuous-learning-v2` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `contract-first` | (EN) Coordinate frontend/backend or service-to-service work through one authoritative machine-c |  |
| `conventional-commit-review` | Revisa cambios staged y redacta mensaje Conventional Commits | 🛠 |
| `cost-aware-llm-pipeline` | (EN) Cost optimization patterns for LLM API usage — model routing by task complexity, budget tr |  |
| `cost-tracking` | (EN) Track and report Claude Code token usage, spending, and budgets from the local ECC cost-tr |  |
| `council` | Consejo de cuatro voces para decisiones ambiguas | 🛠 |
| `council-multi-model` | (EN) Add one optional external Codex critique after the existing council has produced a decisio |  |
| `counterparty-channel-discipline` | Operaciones de negocio/logística (nicho) |  |
| `cpp-coding-standards` | Patrones/pruebas de lenguaje o framework de desarrollo (cpp) |  |
| `cpp-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (cpp) |  |
| `crosspost` | Distribuye contenido a X, LinkedIn, Threads y Bluesky adaptándolo por plataforma (sin publicar idéntico) | ⭐ |
| `csharp-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (csharp) |  |
| `customer-billing-ops` | Operaciones de negocio/logística (nicho) |  |
| `customs-trade-compliance` | Operaciones de negocio/logística (nicho) |  |
| `dart-flutter-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (dart) |  |
| `dashboard-builder` | (EN) Build monitoring dashboards that answer real operator questions for Grafana, SigNoz, and s |  |
| `data-scraper-agent` | (EN) Build a fully automated AI-powered data collection agent for any public source — job board |  |
| `data-throughput-accelerator` | (EN) Diagnose and accelerate large data movement — ingestion, backfill, export, ETL, warehouse  |  |
| `database-migrations` | (EN) "Safe, reversible database migration patterns: forward-only production changes, expand-con |  |
| `deep-research` | Informes de investigación con citas usando firecrawl y exa MCP | ⭐ |
| `deepseek-harness-setup` | (EN) "Install and operate Everything Claude Code (ECC) on the DeepSeek Harness (DSH): native sk |  |
| `defi-amm-security` | Cripto / trading / mercados (nicho) |  |
| `delivery-gate` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `deployment-patterns` | (EN) Deployment workflows, CI/CD pipeline patterns, Docker containerization, health checks, rol |  |
| `design-system` | (EN) "Generate a design system from an existing codebase or audit one for visual consistency: e |  |
| `dev-team` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `devfleet` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `django-celery` | Patrones/seguridad/pruebas del framework django |  |
| `django-patterns` | Patrones/seguridad/pruebas del framework django |  |
| `django-security` | Patrones/seguridad/pruebas del framework django |  |
| `django-tdd` | Patrones/seguridad/pruebas del framework django |  |
| `django-verification` | Patrones/seguridad/pruebas del framework django |  |
| `dmux-workflows` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `docker-patterns` | Patrones Docker | 🛠 |
| `docs-governance` | (EN) Route broad documentation-governance requests to existing ECC skills and run an opt-in, re |  |
| `documentation-lookup` | Documentación actualizada de librerías vía Context7 MCP | 🛠 |
| `dotnet-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (dotnet) |  |
| `dynamic-workflow-mode` | (EN) "Design task-local harnesses, eval gates, and reusable skill extraction for Claude dynamic |  |
| `e2e-testing` | (EN) Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, arti |  |
| `ecc-contribution-review` | (EN) Prepare an ECC skill contribution for review by organizing repository, install-surface, cr |  |
| `ecc-guide` | (EN) Answer questions about ECC by reading the live repo surface — agents, skills, commands, ho |  |
| `ecc-recipes` | (EN) Map a described workflow to the right ECC command group with run-order and stop condition, |  |
| `ecc-tools-cost-audit` | (EN) Evidence-first ECC Tools burn and billing audit workflow. Use when investigating runaway P |  |
| `email-ops` | Operaciones de negocio/logística (nicho) |  |
| `energy-procurement` | Operaciones de negocio/logística (nicho) |  |
| `enterprise-agent-ops` | (EN) Operational controls for long-lived or cloud-hosted agent systems — runtime lifecycle (sta |  |
| `error-handling` | Patrones de manejo de errores | 🛠 |
| `esign-field-placement` | Operaciones de negocio/logística (nicho) |  |
| `eval-harness` | (EN) Eval-driven development (EDD) framework for AI coding sessions — define capability and reg |  |
| `evm-token-decimals` | Cripto / trading / mercados (nicho) |  |
| `exa-search` | Búsqueda neuronal Exa MCP (web, código, empresas); requiere EXA_API_KEY | ⭐ |
| `fal-ai-media` | Generación de imagen/video/audio vía fal.ai MCP (requiere FAL_KEY) | ⭐ |
| `fastapi-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (fastapi) |  |
| `finance-billing-ops` | Operaciones de negocio/logística (nicho) |  |
| `flox-environments` | (EN) "Create reproducible, cross-platform (macOS/Linux) development environments with Flox, a d |  |
| `flutter-dart-code-review` | Patrones/pruebas de lenguaje o framework de desarrollo (flutter) |  |
| `foundation-models-on-device` | (EN) Apple FoundationModels framework for on-device LLM — text generation, guided generation wi |  |
| `frontend-a11y` | (EN) Accessibility patterns for React and Next.js — semantic HTML, ARIA attributes, form labeli |  |
| `frontend-design-direction` | (EN) Set an ECC-specific frontend design direction for production UI work. Use when building or |  |
| `frontend-patterns` | (EN) Frontend development patterns for React, Next.js, state management, performance optimizati |  |
| `frontend-slides` | Presentaciones HTML animadas o conversión de PPTX a web | ⭐ |
| `fsharp-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (fsharp) |  |
| `gan-style-harness` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `gateguard` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `generating-python-installer` | (EN) "Commercial-grade Python installer expert for Windows: Nuitka extreme compilation, dist sl |  |
| `git-workflow` | Flujos git: ramas, commits, rebase vs merge, conflictos | 🛠 |
| `github-ops` | Operaciones GitHub con gh CLI: issues, PRs, CI, releases | 🛠 |
| `godot-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (godot) |  |
| `godot-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (godot) |  |
| `golang-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (golang) |  |
| `golang-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (golang) |  |
| `google-workspace-ops` | Operación de Drive/Docs/Sheets/Slides como un solo flujo |  |
| `growth-log` | Bitácora de crecimiento | ⭐ |
| `healthcare-cdss-patterns` | Salud / cumplimiento (nicho) |  |
| `healthcare-emr-patterns` | Salud / cumplimiento (nicho) |  |
| `healthcare-eval-harness` | Salud / cumplimiento (nicho) |  |
| `healthcare-phi-compliance` | Salud / cumplimiento (nicho) |  |
| `hermes-imports` | (EN) Convert local Hermes operator workflows into sanitized ECC skills and release-pack artifac |  |
| `hexagonal-architecture` | (EN) Design, implement, and refactor Ports & Adapters systems with clear domain boundaries, dep |  |
| `hipaa-compliance` | Salud / cumplimiento (nicho) |  |
| `homelab-network-readiness` | Redes / homelab (infraestructura) |  |
| `homelab-network-setup` | Redes / homelab (infraestructura) |  |
| `homelab-pihole-dns` | Redes / homelab (infraestructura) |  |
| `homelab-vlan-segmentation` | Redes / homelab (infraestructura) |  |
| `homelab-wireguard-vpn` | Redes / homelab (infraestructura) |  |
| `hookify-rules` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `i18n-sync` | (EN) "Translate and synchronize application JSON locale files using source-key usage, project t |  |
| `inherit-legacy-style` | (EN) Prevent AI style drift on legacy projects by scanning the codebase for implicit convention |  |
| `intent-driven-development` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `inventory-demand-planning` | Operaciones de negocio/logística (nicho) |  |
| `investor-materials` | Materiales para inversionistas (decks, one-pagers) | ⭐ |
| `investor-outreach` | Operaciones de negocio/logística (nicho) |  |
| `ios-icon-gen` | Patrones/pruebas de lenguaje o framework de desarrollo (ios) |  |
| `issue-review` | (EN) Review a GitHub issue the way /code-review reviews a PR. Fetches the issue with the gh CLI |  |
| `iterative-retrieval` | (EN) Pattern for progressively refining context retrieval to solve the subagent context problem |  |
| `ito-baskets` | Cripto / trading / mercados (nicho) |  |
| `ito-compute` | Cripto / trading / mercados (nicho) |  |
| `ito-inference` | Cripto / trading / mercados (nicho) |  |
| `ito-training` | Cripto / trading / mercados (nicho) |  |
| `java-coding-standards` | Patrones/pruebas de lenguaje o framework de desarrollo (java) |  |
| `jira-integration` | (EN) Retrieves Jira tickets, analyzes requirements, updates ticket status, adds comments, or tr |  |
| `jpa-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (jpa) |  |
| `knowledge-ops` | (EN) Knowledge base management, ingestion, sync, and retrieval across multiple storage layers ( |  |
| `kotlin-coroutines-flows` | Patrones/pruebas de lenguaje o framework de desarrollo (kotlin) |  |
| `kotlin-exposed-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (kotlin) |  |
| `kotlin-ktor-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (kotlin) |  |
| `kotlin-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (kotlin) |  |
| `kotlin-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (kotlin) |  |
| `kubernetes-patterns` | (EN) Kubernetes workload patterns, resource management, RBAC, probes, autoscaling, ConfigMap/Se |  |
| `laravel-patterns` | Patrones/seguridad/pruebas del framework laravel |  |
| `laravel-plugin-discovery` | Patrones/seguridad/pruebas del framework laravel |  |
| `laravel-security` | Patrones/seguridad/pruebas del framework laravel |  |
| `laravel-tdd` | Patrones/seguridad/pruebas del framework laravel |  |
| `laravel-verification` | Patrones/seguridad/pruebas del framework laravel |  |
| `latency-critical-systems` | (EN) Optimize and verify latency-sensitive systems — realtime dashboards, market data feeds, st |  |
| `lead-intelligence` | Pipeline de prospección y outreach con IA (requiere varias API keys) | ⭐ |
| `leanrea` | (EN) Reverse engineers shipped software with bounded local CLI inspection. Covers PE headers, E |  |
| `liquid-glass-design` | Patrones/pruebas de lenguaje o framework de desarrollo (liquid) |  |
| `living-docs-governance` | (EN) "Keep a long-lived project's documentation from rotting by assigning existing project docs |  |
| `llm-trading-agent-security` | Cripto / trading / mercados (nicho) |  |
| `logistics-exception-management` | Operaciones de negocio/logística (nicho) |  |
| `loop-design-check` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `mailtrap-email-integration` | (EN) Guides agents through integrating transactional email sending via Mailtrap's Email API, in |  |
| `make-interfaces-feel-better` | (EN) Apply concrete design-engineering details that make interfaces feel polished. Use when rev |  |
| `manim-video` | Explicativos animados con Manim para conceptos técnicos | ⭐ |
| `market-research` | Investigación de mercado, competencia y due diligence con atribución de fuentes | ⭐ |
| `marketing-campaign` | Planeación de campañas: audiencia, posicionamiento, landing, emails, anuncios, guiones cortos, calendario | ⭐ |
| `master-agreement-generator` | Operaciones de negocio/logística (nicho) |  |
| `mcp-dependency-review` | (EN) Statically review MCP configuration for mutable package references before approval or CI,  |  |
| `mcp-server-patterns` | (EN) Build MCP servers with Node/TypeScript SDK — tools, resources, prompts, Zod validation, st |  |
| `messages-ops` | (EN) Evidence-first live messaging workflow for ECC. Use when the user wants to read texts or D |  |
| `ml-adoption-playbook` | (EN) End-to-end methodology for AI agents and software engineers to add machine learning algori |  |
| `mle-workflow` | (EN) Production machine-learning engineering workflow for data contracts, reproducible training |  |
| `module-governance` | (EN) - Establish or maintain a business module's local agent instructions, domain-context links |  |
| `module-regression` | (EN) - Govern cross-module regression in large repositories with a REGRESSION.md ledger that re |  |
| `motion-advanced` | (EN) Advanced motion patterns for React / Next.js — drag & drop, gestures, text animations, SVG |  |
| `motion-foundations` | (EN) Motion tokens, spring presets, performance rules, device adaptation, accessibility enforce |  |
| `motion-patterns` | (EN) Production-ready animation patterns for React / Next.js — button, modal, toast, stagger, p |  |
| `mybatis-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (mybatis) |  |
| `mysql-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (mysql) |  |
| `nanoclaw-repl` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `nasiko-control-plane` | (EN) Manage the experimental Nasiko CLI lifecycle through ECC — read-only status checks, consen |  |
| `nestjs-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (nestjs) |  |
| `netmiko-ssh-automation` | Redes / homelab (infraestructura) |  |
| `network-bgp-diagnostics` | Redes / homelab (infraestructura) |  |
| `network-config-validation` | Redes / homelab (infraestructura) |  |
| `network-interface-health` | Redes / homelab (infraestructura) |  |
| `nextjs-turbopack` | Patrones/pruebas de lenguaje o framework de desarrollo (nextjs) |  |
| `nodejs-keccak256` | Cripto / trading / mercados (nicho) |  |
| `nutrient-document-processing` | (EN) Process, convert, OCR, extract, redact, sign, and fill documents using the Nutrient DWS AP |  |
| `nuxt4-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (nuxt) |  |
| `openclaw-persona-forge` | (EN) "为 OpenClaw AI Agent 锻造完整的龙虾灵魂方案。根据用户偏好或随机抽卡， 输出身份定位、灵魂描述(SOUL.md)、角色化底线规则、名字和头像生图提示词。 如当前 |  |
| `opensource-pipeline` | (EN) "Open-source pipeline: fork, sanitize, and package private projects for safe public releas |  |
| `operator-approval-loop` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-add-feature` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-build-mvp` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-change-feature` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-fix-defect` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-pipeline` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `orch-refine-code` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `osint-investigation` | Investigación científica/OSINT (nicho) |  |
| `parallel-execution-optimizer` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `perl-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (perl) |  |
| `perl-security` | Patrones/pruebas de lenguaje o framework de desarrollo (perl) |  |
| `perl-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (perl) |  |
| `plan-canvas` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `plan-orchestrate` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `plankton-code-quality` | (EN) "Write-time code quality enforcement using Plankton — auto-formatting, linting, and Claude |  |
| `platform-factory` | (EN) Build deterministic OCI images, SBOM/provenance evidence and hardened container or microVM |  |
| `postgres-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (postgres) |  |
| `prediction-market-oracle-research` | Cripto / trading / mercados (nicho) |  |
| `prediction-market-risk-review` | Cripto / trading / mercados (nicho) |  |
| `prisma-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (prisma) |  |
| `product-capability` | (EN) Translate PRD intent, roadmap asks, or product discussions into an implementation-ready ca |  |
| `product-lens` | (EN) Validate the why before building through four product diagnostics — a YC-style product dia |  |
| `production-audit` | Operaciones de negocio/logística (nicho) |  |
| `production-scheduling` | Operaciones de negocio/logística (nicho) |  |
| `project-flow-ops` | (EN) Operate execution flow across GitHub and Linear by triaging issues and pull requests, link |  |
| `prompt-caching-strategy` | (EN) - Optimize LLM prompt caching hit rate to reduce API costs and improve latency. Analyzes p |  |
| `prompt-optimizer` | (EN) Analyze draft prompts, detect intent and missing context, match ECC commands, skills, and  |  |
| `python-patterns` | Modismos Python, PEP 8, type hints | 🛠 |
| `python-testing` | Pruebas en Python con pytest, fixtures, mocks, cobertura | 🛠 |
| `pytorch-patterns` | (EN) PyTorch deep learning patterns and best practices for building robust, efficient, and repr |  |
| `quality-nonconformance` | Operaciones de negocio/logística (nicho) |  |
| `quarkus-patterns` | Patrones/seguridad/pruebas del framework quarkus |  |
| `quarkus-security` | Patrones/seguridad/pruebas del framework quarkus |  |
| `quarkus-tdd` | Patrones/seguridad/pruebas del framework quarkus |  |
| `quarkus-verification` | Patrones/seguridad/pruebas del framework quarkus |  |
| `rails-patterns` | Patrones/seguridad/pruebas del framework rails |  |
| `rails-security` | Patrones/seguridad/pruebas del framework rails |  |
| `ralphinho-rfc-pipeline` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `react-native-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (react) |  |
| `react-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (react) |  |
| `react-performance` | Patrones/pruebas de lenguaje o framework de desarrollo (react) |  |
| `react-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (react) |  |
| `recsys-pipeline-architect` | (EN) Design composable recommendation, ranking, and feed pipelines using the six-stage Source→H |  |
| `recursive-decision-ledger` | (EN) Run repeated rollouts ("Prime Gauss" style recursive prompting) while keeping an append-on |  |
| `redis-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (redis) |  |
| `regex-vs-llm-structured-text` | (EN) Decision framework for parsing structured text (quizzes, forms, invoices, receipts, tables |  |
| `remotion-video-creation` | Buenas prácticas de Remotion (video en React): animaciones, audio, subtítulos | ⭐ |
| `repo-scan` | (EN) Bootstrap pointer that installs the external repo-scan skill from a pinned, reviewable com |  |
| `research-ops` | Investigación basada en evidencia actual y pública, comparaciones y recomendaciones | ⭐ |
| `returns-reverse-logistics` | Operaciones de negocio/logística (nicho) |  |
| `roundhouse-x402` | Cripto / trading / mercados (nicho) |  |
| `rules-distill` | (EN) "Scan skills to extract cross-cutting principles and distill them into rules — append, rev |  |
| `rust-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (rust) |  |
| `rust-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (rust) |  |
| `safety-guard` | (EN) "Guard against destructive operations with three modes: Careful intercepts dangerous comma |  |
| `santa-method` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `scientific-db-openalex-database` | Investigación científica/OSINT (nicho) |  |
| `scientific-db-pubmed-database` | Investigación científica/OSINT (nicho) |  |
| `scientific-db-uspto-database` | Investigación científica/OSINT (nicho) |  |
| `scientific-pkg-gget` | Investigación científica/OSINT (nicho) |  |
| `scientific-thinking-literature-review` | Investigación científica/OSINT (nicho) |  |
| `scientific-thinking-scholar-evaluation` | Investigación científica/OSINT (nicho) |  |
| `search-first` | Investigar herramientas existentes antes de escribir código propio | 🛠 |
| `security-bounty-hunter` | (EN) Hunt for exploitable, bounty-worthy security issues in repositories. Focuses on remotely r |  |
| `security-review` | Checklist de revisión de seguridad (auth, input, secretos, APIs) | 🛠 |
| `security-scan` | Escaneo de seguridad de la configuración de Claude Code (AgentShield) | 🛠 |
| `seo` | Auditoría y mejora SEO técnica, on-page, datos estructurados y estrategia de contenido | ⭐ |
| `short-video-distribution` | Publica video vertical en TikTok/Shorts/Reels: valida límites, títulos, aprobación explícita | ⭐ |
| `skill-comply` | (EN) Visualize whether skills, rules, and agent definitions are actually followed — auto-genera |  |
| `skill-host-compat` | (EN) Lint ECC skills for Codex/Cursor-safe frontmatter and Claude-only substitutions before a s |  |
| `skill-scout` | (EN) Search existing local, marketplace, GitHub, and web skill sources before creating a new sk |  |
| `skill-stocktake` | (EN) "Use when auditing Claude skills and commands for quality. Supports Quick Scan (changed sk |  |
| `social-graph-ranker` | (EN) Weighted social-graph ranking for warm intro discovery, bridge scoring, and network gap an |  |
| `social-publisher` | Programa/publica en 13 redes vía SocialClaw (servicio de terceros, requiere SC_API_KEY) | ⭐ |
| `springboot-patterns` | Patrones/seguridad/pruebas del framework springboot |  |
| `springboot-security` | Patrones/seguridad/pruebas del framework springboot |  |
| `springboot-tdd` | Patrones/seguridad/pruebas del framework springboot |  |
| `springboot-verification` | Patrones/seguridad/pruebas del framework springboot |  |
| `story-lifecycle` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `strategic-compact` | (EN) Suggests manual context compaction at logical intervals to preserve context through task p |  |
| `swift-actor-persistence` | Patrones/pruebas de lenguaje o framework de desarrollo (swift) |  |
| `swift-concurrency-6-2` | Patrones/pruebas de lenguaje o framework de desarrollo (swift) |  |
| `swift-protocol-di-testing` | Patrones/pruebas de lenguaje o framework de desarrollo (swift) |  |
| `swiftui-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (swift) |  |
| `taste` | (EN) Creative-direction layer for music videos and short-form edits in the angelcore / cloud-tr |  |
| `taste-application` | (EN) Generate new video against a distilled style pack and cut it into a finished piece - plan  |  |
| `taste-distillation` | (EN) Measure a set of reference videos into a reusable style pack - colour grade as a 3D LUT, c |  |
| `tasteforge-video` | Descubrimiento multimodal de imagen/video/3D, entrevistas de gusto, exportación EDL/FCPXML | ⭐ |
| `tdd-workflow` | Flujo TDD: prueba que falla primero, implementar, refactorizar | 🛠 |
| `team-agent-orchestration` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `team-builder` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `terminal-opener` | (EN) Open an executable and its argument array in a visible terminal window through a reusable, |  |
| `terminal-ops` | (EN) Evidence-first repo execution workflow for ECC. Use when the user wants a command run, a r |  |
| `terraform-patterns` | (EN) Terraform and OpenTofu infrastructure-as-code patterns for project layout, remote state, m |  |
| `test-collaboration` | (EN) "Inventory and govern a project's test assets. Connect requirements, business rules, risks |  |
| `tinystruct-patterns` | (EN) Expert guidance for developing with the tinystruct Java framework. Use when working on the |  |
| `token-budget-advisor` | (EN) Offer a choice of response depth (25%/50%/75%/100%) with token estimates before answering, |  |
| `token-card` | (EN) Render a token-usage stat card from local Claude Code, Codex, Gemini CLI, and OpenCode ses |  |
| `typescript-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (typescript) |  |
| `ui-canvas` | (EN) Preview a UI component mockup in a local browser canvas where the human directly edits it  |  |
| `ui-demo` | (EN) Record polished UI demo videos using Playwright. Use when the user asks to create a demo,  |  |
| `ui-to-vue` | (EN) Use when the user has UI screenshots or design exports that need batch conversion into Vue |  |
| `uncloud` | (EN) Use when managing an Uncloud cluster — deploying services, configuring Caddy ingress, addi |  |
| `unified-memory` | Orquestación/arneses de agentes (meta-herramientas de Claude Code) |  |
| `unified-notifications-ops` | (EN) Operate notifications as one ECC-native workflow across GitHub, Linear, desktop alerts, ho |  |
| `verification-loop` | Verificación en 6 fases (build, tipos, lint, tests, seguridad, diff) con reporte PASS/FAIL | 🛠 |
| `video-editing` | Flujo de edición de video con FFmpeg, Remotion, ElevenLabs, fal.ai, Descript/CapCut | ⭐ |
| `videodb` | Ingesta, indexado, búsqueda y edición de video/audio con VideoDB SDK (requiere VIDEO_DB_API_KEY) | ⭐ |
| `visa-doc-translate` | Operaciones de negocio/logística (nicho) |  |
| `vite-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (vite) |  |
| `vue-patterns` | Patrones/pruebas de lenguaje o framework de desarrollo (vue) |  |
| `web-perimeter-owasp-2025-audit` | (EN) Passive, non-destructive web perimeter security auditing mapped to OWASP Top 10:2025 surfa |  |
| `windows-desktop-e2e` | (EN) E2E testing for Windows native desktop apps (WPF, WinForms, Win32/MFC, Qt) using pywinauto |  |
| `workspace-surface-audit` | (EN) Audit the active repo, MCP servers, plugins, connectors, env surfaces, and harness setup,  |  |
| `x-api` | Integración con API de X/Twitter (publicar, leer, analítica); requiere tokens de X | ⭐ |
| `yoruba-localization-testing` | (EN) Test Yoruba (yo) and English bilingual interfaces for tone marks, underdots, Unicode norma |  |