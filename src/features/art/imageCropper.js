import { IMAGE_PRESET } from "../../core/constants.js";
import {
  artCropModal,
  cropFocusXRange,
  cropFocusYRange,
  cropGuidance,
  cropModalTitle,
  cropPresetPill,
  cropPreviewCanvas,
  cropZoomRange,
  cropZoomValue,
} from "../../core/dom.js";
import { appState } from "../../core/state.js";
import { syncBodyScrollLock } from "../../core/ui.js";

export async function optimizeUploadedImage(file, kind) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  const preset = IMAGE_PRESET[kind];
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  return openImageCropper(image, kind, preset);
}

export function openImageCropper(image, kind, preset) {
  if (!artCropModal || !cropPreviewCanvas) {
    throw new Error("The image cropper could not be opened.");
  }

  if (appState.cropSession?.reject) {
    appState.cropSession.reject(new Error("Image crop cancelled."));
  }

  const previewSize = getCropPreviewSize(preset);
  cropPreviewCanvas.width = previewSize.width;
  cropPreviewCanvas.height = previewSize.height;

  cropModalTitle.textContent = `Adjust ${preset.label}`;
  cropGuidance.textContent = `Recommended upload: ${preset.recommendedSize}. This crop saves as ${preset.ratioLabel}.`;
  cropPresetPill.textContent = `${preset.label} • ${preset.ratioLabel}`;

  const nextSession = {
    image,
    kind,
    preset,
    zoom: 1,
    focusX: 50,
    focusY: 50,
  };

  appState.cropSession = nextSession;
  resetCropControls();
  artCropModal.hidden = false;
  syncBodyScrollLock();
  renderCropPreview();

  return new Promise((resolve, reject) => {
    nextSession.resolve = resolve;
    nextSession.reject = reject;
  });
}

export function getCropPreviewSize(preset) {
  const maxWidth = 420;
  const maxHeight = 320;
  const ratio = preset.width / preset.height;
  let width = maxWidth;
  let height = Math.round(width / ratio);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  return { width, height };
}

export function handleCropControlInput() {
  if (!appState.cropSession) return;

  appState.cropSession.zoom = Number(cropZoomRange.value) / 100;
  appState.cropSession.focusX = Number(cropFocusXRange.value);
  appState.cropSession.focusY = Number(cropFocusYRange.value);
  cropZoomValue.textContent = `${Math.round(appState.cropSession.zoom * 100)}%`;
  renderCropPreview();
}

export function resetCropControls() {
  if (!appState.cropSession) return;

  cropZoomRange.value = "100";
  cropFocusXRange.value = "50";
  cropFocusYRange.value = "50";
  appState.cropSession.zoom = 1;
  appState.cropSession.focusX = 50;
  appState.cropSession.focusY = 50;
  cropZoomValue.textContent = "100%";
  renderCropPreview();
}

export function handleCropModalClick(event) {
  if (event.target instanceof HTMLElement && event.target.dataset.closeCropModal !== undefined) {
    cancelCropSelection();
  }
}

export function cancelCropSelection() {
  if (!appState.cropSession) return;

  const current = appState.cropSession;
  closeCropModal();
  current.reject?.(new Error("Image crop cancelled."));
}

export function confirmCropSelection() {
  if (!appState.cropSession) return;

  const current = appState.cropSession;
  const canvas = document.createElement("canvas");
  canvas.width = current.preset.width;
  canvas.height = current.preset.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    closeCropModal();
    current.reject?.(new Error("Could not create the cropped image."));
    return;
  }

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCropFrame(
    ctx,
    current.image,
    canvas.width,
    canvas.height,
    current.zoom,
    current.focusX,
    current.focusY
  );

  const dataUrl = canvas.toDataURL("image/jpeg", current.preset.quality);
  closeCropModal();
  current.resolve?.(dataUrl);
}

export function closeCropModal() {
  appState.cropSession = null;
  if (artCropModal) artCropModal.hidden = true;
  syncBodyScrollLock();
}

export function renderCropPreview() {
  if (!appState.cropSession || !cropPreviewCanvas) return;

  const ctx = cropPreviewCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, cropPreviewCanvas.width, cropPreviewCanvas.height);

  drawCropFrame(
    ctx,
    appState.cropSession.image,
    cropPreviewCanvas.width,
    cropPreviewCanvas.height,
    appState.cropSession.zoom,
    appState.cropSession.focusX,
    appState.cropSession.focusY
  );
}

export function drawCropFrame(ctx, image, width, height, zoom = 1, focusX = 50, focusY = 50) {
  const baseScale = Math.max(width / image.width, height / image.height);
  const appliedScale = baseScale * zoom;
  const drawWidth = image.width * appliedScale;
  const drawHeight = image.height * appliedScale;
  const maxOffsetX = Math.max(0, drawWidth - width);
  const maxOffsetY = Math.max(0, drawHeight - height);
  const offsetX = -maxOffsetX * (focusX / 100);
  const offsetY = -maxOffsetY * (focusY / 100);

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not process the selected image."));
    image.src = src;
  });
}
