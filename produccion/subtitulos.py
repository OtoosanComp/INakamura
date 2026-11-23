"""Subtítulos: frases cortas (1-3 palabras) pensadas para Reels.

- .srt  → para Facebook (nombre <video>.es_LA.srt) o CapCut Web/Escritorio.
- .ass  → estilo para quemarlos en el video (grandes, centrados, palabra clave en color).
Reglas: máx. 3 palabras o 18 caracteres por bloque; se corta en signos de puntuación;
nunca cruza de una escena a otra; sin huecos parpadeantes (< 0.25 s se unen).
"""
import re

MAX_PALABRAS, MAX_CHARS, MIN_DUR, HUECO = 3, 18, 0.35, 0.25
CORTE = re.compile(r"[.,;:?!…]$|\.\.\.$")
ACENTO_ASS = "&H004A73E8&"  # cobrizo de Yami (#E8734A) en formato BGR de ASS


def bloques(palabras):
    out, actual = [], []
    for i, p in enumerate(palabras):
        actual.append(p)
        texto = " ".join(x["palabra"] for x in actual)
        sig = palabras[i + 1] if i + 1 < len(palabras) else None
        fin = (sig is None or sig["escena"] != p["escena"] or CORTE.search(p["palabra"])
               or len(actual) >= MAX_PALABRAS
               or (sig and len(texto) + 1 + len(sig["palabra"]) > MAX_CHARS))
        if fin:
            out.append({"texto": texto, "ini": actual[0]["ini"], "fin": actual[-1]["fin"], "escena": p["escena"]})
            actual = []
    for a, b in zip(out, out[1:]):
        if b["ini"] - a["fin"] < HUECO:
            a["fin"] = b["ini"]
        a["fin"] = max(a["fin"], a["ini"] + MIN_DUR) if a["fin"] < b["ini"] else a["fin"]
    return out


def _limpio(t):
    # En pantalla no hacen falta los puntos suspensivos ni comas finales.
    return re.sub(r"(\.\.\.|…|,|\.|:|;)$", "", t).strip()


def _ts_srt(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def _ts_ass(s):
    cs = int(round(s * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def escribir_srt(bs, ruta):
    with open(ruta, "w", encoding="utf-8") as f:
        for n, b in enumerate(bs, 1):
            f.write(f"{n}\n{_ts_srt(b['ini'])} --> {_ts_srt(b['fin'])}\n{_limpio(b['texto'])}\n\n")


def escribir_ass(bs, ruta, resaltar=(), fuente="Inter Display Black", y=1180):
    clave = [r.lower() for r in resaltar]

    def colorear(texto):
        palabras = texto.split()
        res = []
        for w in palabras:
            base = re.sub(r"[^\wáéíóúñü]", "", w.lower())
            if base and any(base == c or base in c.split() for c in clave):
                res.append(r"{\c" + ACENTO_ASS + "}" + w + r"{\c&H00FFFFFF&}")
            else:
                res.append(w)
        return " ".join(res)  # las frases ("vínculo traumático") se colorean palabra por palabra

    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Yami,{fuente},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,7,4,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(cab)
        for b in bs:
            pop = r"{\pos(540," + str(y) + r")\fscx82\fscy82\t(0,90,\fscx100\fscy100)}"
            f.write(f"Dialogue: 0,{_ts_ass(b['ini'])},{_ts_ass(b['fin'])},Yami,,0,0,0,,{pop}{colorear(_limpio(b['texto']).upper())}\n")
