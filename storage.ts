import { blobToDataUrl } from './photo';
export interface SavedProject {
  id: string;
  title: string;
  character: 'yami' | 'tsuki';
  createdAt: string;
  original: string;
  edited: string;
  profile: string;
}
const KEY = 'nts.projects.v03';
export function getProjects(): SavedProject[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as SavedProject[]; }
  catch { return []; }
}
export async function saveProject(args: Omit<SavedProject, 'id'|'createdAt'|'original'|'edited'> & { original: Blob; edited: Blob }): Promise<SavedProject> {
  const project: SavedProject = {
    ...args, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    original: await blobToDataUrl(args.original), edited: await blobToDataUrl(args.edited)
  };
  const current = getProjects();
  current.unshift(project);
  try { localStorage.setItem(KEY, JSON.stringify(current)); }
  catch { throw new Error('El almacenamiento del navegador está lleno. Exporta o elimina proyectos antes de guardar otra foto.'); }
  return project;
}
export function removeProject(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getProjects().filter(p => p.id !== id)));
}