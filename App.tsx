import { useEffect, useMemo, useRef, useState } from 'react';
import { Aperture, Camera, Check, ChevronRight, Download, FileImage, FolderOpen, ImagePlus, Info, LoaderCircle, Palette, Sparkles, Trash2, Upload, WandSparkles } from 'lucide-react';
import { yamiCanon } from './canon/yami.canon';
import { tsukiCanon } from './canon/tsuki.canon';
import { looks, type CharacterId } from './canon/profiles';
import { captureRearCamera } from './lib/camera';
import { dataUrlToBlob, renderLook } from './lib/photo';
import { getProjects, removeProject, saveProject, type SavedProject } from './lib/storage';

type Tab = 'camera' | 'editor' | 'projects' | 'ai';
export default function App() {
  const [tab, setTab] = useState<Tab>('camera');
  const [character, setCharacter] = useState<CharacterId>('yami');
  const [original, setOriginal] = useState<Blob | null>(null);
  const [edited, setEdited] = useState<Blob | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  const [projects, setProjects] = useState<SavedProject[]>(getProjects);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Listo para crear.');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const canon = character === 'yami' ? yamiCanon : tsukiCanon;
  const look = looks[character];
  const displayUrl = editedUrl || originalUrl;
  useEffect(() => {
    if (original) setOriginalUrl(URL.createObjectURL(original));
    else setOriginalUrl('');
    return () => { if (originalUrl.startsWith('blob:')) URL.revokeObjectURL(originalUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);
  useEffect(() => {
    if (edited) setEditedUrl(URL.createObjectURL(edited));
    else setEditedUrl('');
    return () => { if (editedUrl.startsWith('blob:')) URL.revokeObjectURL(editedUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited]);
  const currentLook = useMemo(() => ({ ...look, brightness: look.brightness + brightness, contrast: look.contrast + contrast, saturation: look.saturation + saturation }), [look, brightness, contrast, saturation]);
  async function loadBlob(blob: Blob) {
    setOriginal(blob); setEdited(null); setBrightness(0); setContrast(0); setSaturation(0); setTab('editor'); setMessage('Foto cargada. Elige un perfil o ajusta la imagen.');
  }
  async function capture() {
    setBusy(true);
    try { await loadBlob(await captureRearCamera()); }
    catch (e) { setMessage(errMessage(e)); }
    finally { setBusy(false); }
  }
  async function applyProfile() {
    if (!original) { setMessage('Primero toma o importa una foto.'); return; }
    setBusy(true);
    try {
      const result = await renderLook(original, currentLook);
      setEdited(result); setMessage(`Perfil ${look.label} aplicado localmente.`);
    } catch (e) { setMessage(errMessage(e)); }
    finally { setBusy(false); }
  }
  async function saveCurrent() {
    if (!original) { setMessage('Primero carga una foto.'); return; }
    setBusy(true);
    try {
      const result = edited || await renderLook(original, currentLook);
      await saveProject({ title: `${canon.name} · ${new Date().toLocaleString('es-MX')}`, character, original, edited: result, profile: look.label });
      setProjects(getProjects()); setMessage('Proyecto guardado en el almacenamiento local de la app.');
    } catch (e) { setMessage(errMessage(e)); }
    finally { setBusy(false); }
  }
  function downloadResult() {
    const blob = edited || original;
    if (!blob) { setMessage('No hay imagen para exportar.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `NTS-${character}-${Date.now()}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setMessage('Se solicitó exportar el PNG. En Android, confirma la descarga si el navegador lo pide.');
  }
  async function openProject(project: SavedProject) {
    setCharacter(project.character); setOriginal(dataUrlToBlob(project.original)); setEdited(dataUrlToBlob(project.edited)); setTab('editor'); setMessage('Proyecto abierto.');
  }
  function chooseCharacter(id: CharacterId) { setCharacter(id); setEdited(null); setBrightness(0); setContrast(0); setSaturation(0); setMessage(`Perfil seleccionado: ${id === 'yami' ? 'Yami' : 'Tsuki'}.`); }
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><Aperture size={24}/></div>
      <div className="brand"><strong>Nakamura Twins Studio</strong><span>PREVIEW FUNCIONAL · 0.3</span></div>
      <button className="icon-button" onClick={() => setTab('ai')} aria-label="IA online"><Sparkles size={20}/></button>
    </header>
    <main>
      <section className="hero">
        <div className="eyebrow">CREATIVE WORKSPACE</div>
        <h1>Tu mirada.<br/><span>Su identidad.</span></h1>
        <p>Fotografía, perfiles y proyectos con el canon de las gemelas protegido.</p>
      </section>
      <section className="character-switch">
        <button className={character === 'yami' ? 'character-card active yami' : 'character-card'} onClick={() => chooseCharacter('yami')}>
          <span className="character-symbol">や</span><span><b>Yami</b><small>Princesa · Cosplayer</small></span>{character === 'yami' && <Check size={18}/>}
        </button>
        <button className={character === 'tsuki' ? 'character-card active tsuki' : 'character-card'} onClick={() => chooseCharacter('tsuki')}>
          <span className="character-symbol">月</span><span><b>Tsuki</b><small>Cine dramático</small></span>{character === 'tsuki' && <Check size={18}/>}
        </button>
      </section>
      <nav className="tabs">
        <button className={tab === 'camera' ? 'selected' : ''} onClick={() => setTab('camera')}><Camera size={17}/> Cámara</button>
        <button className={tab === 'editor' ? 'selected' : ''} onClick={() => setTab('editor')}><Palette size={17}/> Editor</button>
        <button className={tab === 'projects' ? 'selected' : ''} onClick={() => {setProjects(getProjects());setTab('projects')}}><FolderOpen size={17}/> Proyectos</button>
        <button className={tab === 'ai' ? 'selected' : ''} onClick={() => setTab('ai')}><Sparkles size={17}/> IA</button>
      </nav>
      {tab === 'camera' && <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">MODO DE ESCENA</span><h2>Aquí en el parque</h2></div><span className="live-pill"><i/> LOCAL</span></div>
        <div className="camera-placeholder"><div className="camera-icon"><Camera size={35}/></div><b>Tu próxima fotografía</b><p>En el APK se abrirá la cámara trasera. Puedes importar una foto mientras preparas la instalación.</p></div>
        <div className="look-summary"><div className="look-icon"><WandSparkles size={21}/></div><div><b>{look.label}</b><p>{look.description}</p></div></div>
        <button className="primary-button" onClick={capture} disabled={busy}><Camera size={18}/>{busy ? 'Abriendo cámara…' : 'Tomar foto con cámara trasera'}</button>
        <button className="secondary-button" onClick={() => fileRef.current?.click()}><ImagePlus size={18}/> Importar foto del teléfono</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => {const f=e.target.files?.[0]; if(f) void loadBlob(f); e.currentTarget.value='';}}/>
        <p className="microcopy"><Info size={14}/> El modo parque es un perfil de escena; no requiere GPS ni comparte tu ubicación.</p>
      </section>}
      {tab === 'editor' && <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">EDICIÓN LOCAL</span><h2>Editor de fotografía</h2></div><span className="local-badge">OFFLINE</span></div>
        {displayUrl ? <div className="photo-preview"><img src={displayUrl} alt="Vista previa de fotografía"/><span>{editedUrl ? 'RESULTADO' : 'ORIGINAL'}</span></div> : <div className="empty-state"><FileImage size={32}/><b>Aún no hay fotografía</b><p>Usa Cámara o importa una imagen para comenzar.</p><button className="secondary-button" onClick={() => setTab('camera')}>Ir a Cámara <ChevronRight size={16}/></button></div>}
        <div className="look-summary"><div className="look-icon"><WandSparkles size={21}/></div><div><b>{look.label}</b><p>{look.description}</p></div></div>
        <div className="sliders">
          <Slider label="Brillo adicional" value={brightness} min={-40} max={40} onChange={setBrightness}/>
          <Slider label="Contraste adicional" value={contrast} min={-30} max={30} onChange={setContrast}/>
          <Slider label="Saturación adicional" value={saturation} min={-40} max={40} onChange={setSaturation}/>
        </div>
        <button className="primary-button" disabled={!original || busy} onClick={applyProfile}>{busy ? <LoaderCircle className="spin" size={18}/> : <WandSparkles size={18}/>} Aplicar perfil local</button>
        <div className="two-buttons"><button className="secondary-button" disabled={!original || busy} onClick={saveCurrent}><Check size={17}/> Guardar proyecto</button><button className="secondary-button" disabled={!original} onClick={downloadResult}><Download size={17}/> Exportar PNG</button></div>
        <p className="microcopy"><Info size={14}/> Conserva el original por separado. Los perfiles son ajustes de imagen, no generan ni alteran rasgos mediante IA.</p>
      </section>}
      {tab === 'projects' && <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">ARCHIVO LOCAL</span><h2>Tus proyectos</h2></div><span className="local-badge">{projects.length} guardados</span></div>
        {projects.length === 0 ? <div className="empty-state"><FolderOpen size={32}/><b>Tu estudio empieza aquí</b><p>Guarda una fotografía editada para verla en este apartado.</p></div> : <div className="project-list">{projects.map(p => <div className="project-item" key={p.id}><button className="project-open" onClick={() => void openProject(p)}><img src={p.edited} alt="Miniatura del proyecto"/><span><b>{p.title}</b><small>{p.character === 'yami' ? 'Yami' : 'Tsuki'} · {p.profile}</small></span><ChevronRight size={18}/></button><button className="delete-button" aria-label="Eliminar proyecto" onClick={() => {removeProject(p.id);setProjects(getProjects());}}><Trash2 size={17}/></button></div>)}</div>}
        <p className="microcopy"><Info size={14}/> En esta versión los proyectos se guardan en el almacenamiento local de la app. Borrar datos del navegador/app puede eliminarlos; no es una copia de seguridad.</p>
      </section>}
      {tab === 'ai' && <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">MÓDULO ONLINE</span><h2>Asistente creativo</h2></div><span className="pending-badge">EN PREPARACIÓN</span></div>
        <div className="ai-card"><div className="ai-orb"><Sparkles size={29}/></div><h3>Ideas con identidad propia</h3><p>Este módulo está reservado para conectar un servicio de IA generativa online. Todavía no envía fotos ni genera imágenes.</p></div>
        <label className="field-label">Idea para una futura escena</label><textarea className="idea-input" placeholder="Ej. Yami en un taller de cosplay, luz natural de tarde…" rows={3}/>
        <button className="primary-button" onClick={() => setMessage('La integración online aún no está conectada. La idea no se envió a ningún servicio.')}><Sparkles size={18}/> Preparar idea (demo)</button>
        <p className="microcopy"><Info size={14}/> No pegues contraseñas ni claves API en esta app. Para generación online real usaremos un backend o servicio seguro.</p>
      </section>}
      <section className="canon-card"><div className="canon-head"><span className="canon-badge">CANON PROTEGIDO</span><span className="eyebrow">FICHA ACTIVA</span></div><h3>{canon.name}</h3><p>{canon.visual.hair} · {canon.visual.eyes} · {canon.visual.skin}</p><ul>{canon.rules.slice(0,2).map(rule => <li key={rule}>{rule}</li>)}</ul></section>
      <div className="status-line" role="status">{busy && <LoaderCircle className="spin" size={15}/>} {message}</div>
    </main>
    <footer>NAKAMURA TWINS STUDIO <span>·</span> 0.3.0 · HECHO PARA CREAR</footer>
  </div>;
}
function Slider({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void}) {
  return <label className="slider-control"><span>{label}<b>{value > 0 ? '+' : ''}{value}</b></span><input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function errMessage(error: unknown) { return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'; }