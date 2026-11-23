"""Música de fondo y efectos generados por código (sin derechos de autor de terceros)."""
import numpy as np
import soundfile as sf

SR = 48000


def _nota(f, t, detune=0.0):
    return np.sin(2 * np.pi * f * (1 + detune) * t)


def _suavizar(x, a=0.995):
    # filtro pasa-bajas de un polo (vectorizado por bloques sería más rápido; aquí basta)
    from scipy.signal import lfilter
    return lfilter([1 - a], [1, -a], x)


def musica(duracion, ruta, semilla=1):
    """Colchón oscuro en La menor: Am – F – Dm – E, 8 s por acorde, con lluvia suave."""
    rng = np.random.default_rng(semilla)
    n = int(duracion * SR)
    t = np.arange(n) / SR
    acordes = [(110.0, 164.81, 220.0, 261.63), (87.31, 130.81, 220.0, 261.63),
               (73.42, 146.83, 174.61, 220.0), (82.41, 164.81, 207.65, 246.94)]
    pad = np.zeros(n)
    largo = 8.0
    for i in range(int(np.ceil(duracion / largo)) + 1):
        f = acordes[i % 4]
        t0 = i * largo - 1.5
        env = np.clip(np.minimum((t - t0) / 2.0, (t0 + largo + 3.0 - t) / 2.0), 0, 1)
        if not env.any():
            continue
        voz = sum(_nota(fr, t, d) * (0.5 if fr < 120 else 0.3)
                  for fr in f for d in (-0.002, 0.002))
        pad += voz * env
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.07 * t)
    pad = _suavizar(pad * lfo, 0.97)
    lluvia = _suavizar(rng.standard_normal(n), 0.9) * 0.6
    mezcla = pad / (np.abs(pad).max() + 1e-9) * 0.5 + lluvia * 0.08
    fade = np.minimum(1, np.minimum(t / 1.0, (duracion - t) / 1.5))
    sf.write(ruta, (mezcla * np.clip(fade, 0, 1) * 0.6).astype(np.float32), SR)


def efectos(duracion, inicios, ruta, semilla=2, entradas_yami=()):
    """Golpe grave en el segundo 0 (gancho), 'whoosh' suave en cada cambio de escena y,
    cuando Yami sube desde abajo, un barrido ascendente + campanita."""
    rng = np.random.default_rng(semilla)
    n = int(duracion * SR)
    out = np.zeros(n)
    # golpe
    tb = np.arange(int(1.4 * SR)) / SR
    fase = 2 * np.pi * np.cumsum(70 * np.exp(-tb * 1.2) + 32) / SR
    golpe = np.sin(fase) * np.exp(-tb * 3.0) + _suavizar(rng.standard_normal(len(tb)), 0.8) * np.exp(-tb * 12) * 0.3
    out[:len(tb)] += golpe * 0.9
    # whoosh
    tw = np.arange(int(0.45 * SR)) / SR
    env = np.sin(np.pi * tw / tw[-1]) ** 2
    for t0 in inicios[1:]:
        i = int(max(t0 - 0.2, 0) * SR)
        ruido = _suavizar(rng.standard_normal(len(tw)), 0.6) * env * 0.12
        out[i:i + len(tw)] += ruido[:max(0, min(len(tw), n - i))]
    # entrada de Yami: ruido que sube de tono + campanita (La5 y Mi6, acorde de La)
    from scipy.signal import butter, sosfilt
    ts = np.arange(int(0.5 * SR)) / SR
    for t0 in entradas_yami:
        i = int(max(t0 - 0.05, 0) * SR)
        ruido = rng.standard_normal(len(ts))
        barrido = np.zeros(len(ts))
        for k in range(10):  # banda que sube de 400 a 3000 Hz
            a, b = k * len(ts) // 10, (k + 1) * len(ts) // 10
            fc = 400 * (3000 / 400) ** (k / 9)
            sos = butter(2, [fc * 0.7, fc * 1.3], btype="band", fs=SR, output="sos")
            barrido[a:b] = sosfilt(sos, ruido[a:b])
        barrido *= np.sin(np.pi * ts / ts[-1]) * 0.35
        tc = np.arange(int(1.2 * SR)) / SR
        campana = (np.sin(2 * np.pi * 880 * tc) + 0.5 * np.sin(2 * np.pi * 1318.5 * tc)) * np.exp(-tc * 4) * 0.10
        j = i + int(0.42 * SR)
        out[i:i + len(ts)] += barrido[:max(0, min(len(ts), n - i))]
        out[j:j + len(tc)] += campana[:max(0, min(len(tc), n - j))]
    sf.write(ruta, out.astype(np.float32), SR)
