import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export async function captureRearCamera(): Promise<Blob> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('La captura nativa requiere instalar el APK. En la demo web, usa “Importar foto”.');
  }

  const photo = await Camera.getPhoto({
    quality: 92,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    direction: CameraDirection.Rear,
    saveToGallery: false,
    correctOrientation: true
  });

  if (!photo.webPath) {
    throw new Error('La cámara no devolvió una imagen.');
  }

  const response = await fetch(photo.webPath);
  if (!response.ok) {
    throw new Error('No se pudo leer la foto capturada.');
  }

  return await response.blob();
}
