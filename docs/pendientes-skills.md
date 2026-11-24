# Herramientas y skills — estado

Actualizado 2026-11-23. Contexto: solo Claude Code en la nube (sin PC); cada sesión es un contenedor que se borra.

| Herramienta | Estado | Notas |
|---|---|---|
| **ECC** (affaan-m/ECC) | ✅ Instalado | Vendorizado en `herramientas/ecc` (commit `4adeee6`, MIT). 328 skills disponibles; 15 activas en `.claude/skills/` (contenido, investigación, video, git, seguridad, Python). Activar todas = ~27k tokens extra por sesión. Hooks/agentes/comandos NO activados a propósito. Reporte de seguridad: `docs/ecc-reporte.md`. |
| **Skills propias** | ✅ Instaladas | `yami-guion`, `yami-video`, `meta-publicar`. |
| **Kokoro** (voz) | ✅ En uso | Reemplaza a ElevenLabs/VoiceStudio para producir aquí, gratis. |
| **Claude-Mem** | ❌ No aplica | Necesita PC (worker local en `~/.claude-mem`). La "memoria" del proyecto es `CLAUDE.md` + este repo. Si algún día hay PC: `npx claude-mem install`. Docs: https://docs.claude-mem.ai/installation |
| **Free-LLM / OmniRoute** | ❌ No aplica | Routers de modelos para PC. Free-LLM se revisó (commit `85864c4`, sin código malicioso). Script en la rama `ccr-19057618-ez919c`. |
| **VoiceStudio** | ➖ En el teléfono | https://github.com/debpalash/VoiceStudio (AGPL-3.0). Sirve para pruebas en el teléfono; la producción usa Kokoro aquí. |
| **MoneyPrinterV2** | ❌ Descartado | Automatiza bots de X/YouTube, afiliados y correos en frío; necesita PC y arriesga las cuentas. Nuestro pipeline cubre "crear videos desde cero". |
| **ElevenLabs** (conector) | ✅ En uso | Voz de Yami: "Ingrid – natural & soft". Plan gratis = 10k créditos/mes y sin uso comercial; para monetizar hace falta un plan de pago. |

## Pendientes
1. Plan de ElevenLabs con uso comercial; luego renderizar r2 y r3 con Ingrid.
2. Probar la voz de Tsuki (Re4) cuando haga falta.
3. Más imágenes de Yami en ambiente oscuro/casual (para más expresiones).
4. Guardar `produccion/setup.sh` como script de arranque del entorno (para no reinstalar en cada sesión).
5. Escribir el primer video largo para YouTube (esquema listo; ver `docs/videos-largos.md`).
