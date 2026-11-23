# Pendientes: skills y herramientas

Nota de trabajo (2026-11-23). **Nada de esto está instalado todavía.**
Contexto: se trabaja solo desde Claude Code en la nube (sin PC). Cada sesión
corre en un contenedor que se borra al terminar; solo lo que está en GitHub
se conserva.

## Plan acordado

- Las skills van **dentro de cada repo**, en `.claude/skills/<nombre>/SKILL.md`.
  Claude Code las carga solas al abrir una sesión en ese repo.
- Idea: un repo central de skills (p. ej. `OtoosanComp/skills`) del que se
  copian a cada proyecto con un script de sincronización.
  Falta: crear ese repo desde la app de GitHub (Claude no puede crear repos).
- Proyectos a los que se copiarían:
  `INakamura`, `PhoneTouchBridge`, `NakamuraTwinsStudio.`, `nakamura-twins`.
- "Memoria" entre sesiones: un `CLAUDE.md` o `docs/memoria.md` en cada repo,
  en lugar de Claude-Mem.

## Herramientas evaluadas

| Herramienta | Link | ¿Sirve en la nube? | Notas |
|---|---|---|---|
| ECC (Everything Claude Code) | https://github.com/affaan-m/ECC (docs en español: `docs/es/`) | ✅ Sí, eligiendo partes | Es una colección enorme: ~660 archivos de skills, 72 agentes, 99 comandos, 122 reglas, hooks y `CLAUDE.md`. **No copiar todo**: cada skill instalada ocupa espacio en cada sesión. Escoger 5–10 útiles y copiarlas a `.claude/skills/`. Revisar los hooks antes de usarlos. |
| Claude-Mem | https://docs.claude-mem.ai/installation · https://github.com/thedotmack/claude-mem | ❌ No (forma normal) | Guarda la memoria en `~/.claude-mem/` con un worker local; en la nube se borra cada sesión. Su propia guía dice que en un sandbox remoto hay que instalarlo en la PC del usuario. CMEM Pro (hosted) manda el trabajo a cmem.ai y es de pago tras 30 días. Instalación si algún día hay PC: `npx claude-mem install` o `/plugin marketplace add thedotmack/claude-mem` + `/plugin install claude-mem`. |
| Free-LLM | https://github.com/nejib1/Free-LLM | ❌ No | Revisado (commit `85864c4`): sin código malicioso, pero es para PC. Hay un script en `scripts/free-llm-respaldo.sh` que se puede borrar porque no aplica sin PC. |
| OmniRoute | (falta link) | ❌ Probablemente no | Mismo tipo que Free-LLM (router de modelos para PC). |
| VoiceStudio | https://github.com/debpalash/VoiceStudio/releases/tag/v0.5.8 | ➖ No es skill | App de voz (clonar voz, doblaje, dictado, transcripción, narración) que corre en el dispositivo. Ya está instalada en el teléfono: usarla ahí. Licencia AGPL-3.0. |
| MoneyPrinterV2 | https://github.com/FujiwaraChoki/MoneyPrinterV2 | ⚠️ Difícil | App de Python 3.12: bot de Twitter/X, YouTube Shorts automáticos, afiliados de Amazon y envío de correos en frío a negocios sacados de Google Maps. Usa un perfil de Firefox con las sesiones iniciadas, Ollama local, ImageMagick y claves de Gemini/SMTP. Pensada para PC. Ojo: las publicaciones automáticas y el spam pueden hacer que suspendan las cuentas. **Pendiente: definir para qué se necesita** antes de decidir. |

## Siguientes pasos

1. Definir qué se quiere lograr con MoneyPrinter (¿videos cortos? ¿ventas? ¿redes del POS?).
2. Pasar el link de OmniRoute si se quiere evaluar.
3. Crear el repo central de skills.
4. Elegir qué skills de ECC (y propias) entran al paquete.
5. Decidir si se borra `scripts/free-llm-respaldo.sh`.
