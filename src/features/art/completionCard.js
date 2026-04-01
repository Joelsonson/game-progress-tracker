import { getAllSessions } from "../../data/sessionsRepo.js";
import { CARD_TIER_META, GAME_STATUSES } from "../../core/constants.js";
import {
  buildSessionStats,
  emptySessionStats,
  formatDate,
  formatMinutes,
  getCompletionTier,
  getGameCompletionXp,
  getGameObjectiveText,
  getInitials,
} from "../../core/formatters.js";
import { appState } from "../../core/state.js";
import { loadImage } from "./imageCropper.js";

export function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

export async function downloadCompletionCard(game) {
  const sessions = await getAllSessions(appState.db);
  const stats = buildSessionStats(sessions).get(game.id) || emptySessionStats();
  const canvas = await buildCompletionCardCanvas(game, stats);
  const blob = await canvasToBlob(canvas, "image/png");

  downloadBlob(blob, createSafeFilename(`${game.title} goal card.png`));
}

export function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create the completion card image."));
        return;
      }
      resolve(blob);
    }, type);
  });
}

export function createSafeFilename(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildCompletionCardCanvas(game, stats) {
  const width = 900;
  const height = 1260;
  const padding = 54;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const tier = getCompletionTier(game, stats);
  const tierMeta = CARD_TIER_META[tier];
  const totalQuestXp =
    stats.totalXp +
    (game.status === GAME_STATUSES.COMPLETED ? getGameCompletionXp(game) : 0);

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "#071121");
  backgroundGradient.addColorStop(0.6, "#111827");
  backgroundGradient.addColorStop(1, tierMeta.accentB);
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  drawCanvasGlow(ctx, width * 0.82, 120, 220, `${tierMeta.accentA}66`);
  drawCanvasGlow(ctx, 110, 240, 160, "#60a5fa44");

  const bannerImage = game.bannerImage || game.coverImage;
  if (bannerImage) {
    const banner = await loadImage(bannerImage);
    ctx.save();
    roundedRectPath(ctx, padding, padding, width - padding * 2, 300, 28);
    ctx.clip();
    drawImageCover(ctx, banner, padding, padding, width - padding * 2, 300);
    ctx.restore();

    const bannerFade = ctx.createLinearGradient(0, padding, 0, padding + 300);
    bannerFade.addColorStop(0, "rgba(15, 23, 42, 0.12)");
    bannerFade.addColorStop(1, "rgba(15, 23, 42, 0.84)");
    ctx.fillStyle = bannerFade;
    roundedRect(ctx, padding, padding, width - padding * 2, 300, 28, bannerFade);
  } else {
    const bannerFill = ctx.createLinearGradient(
      padding,
      padding,
      width - padding,
      padding + 300
    );
    bannerFill.addColorStop(0, "#172554");
    bannerFill.addColorStop(1, "#0f172a");
    roundedRect(ctx, padding, padding, width - padding * 2, 300, 28, bannerFill);
  }

  const coverX = padding + 28;
  const coverY = 240;
  const coverW = 220;
  const coverH = 294;

  if (game.coverImage) {
    const cover = await loadImage(game.coverImage);
    ctx.save();
    roundedRectPath(ctx, coverX, coverY, coverW, coverH, 26);
    ctx.clip();
    drawImageCover(ctx, cover, coverX, coverY, coverW, coverH);
    ctx.restore();
  } else {
    const placeholderGradient = ctx.createLinearGradient(
      coverX,
      coverY,
      coverX + coverW,
      coverY + coverH
    );
    placeholderGradient.addColorStop(0, "#1d4ed8");
    placeholderGradient.addColorStop(1, "#0f172a");
    roundedRect(ctx, coverX, coverY, coverW, coverH, 26, placeholderGradient);
    ctx.fillStyle = "#dbeafe";
    ctx.font = "900 86px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(getInitials(game.title), coverX + coverW / 2, coverY + 176);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  roundedRectPath(ctx, coverX, coverY, coverW, coverH, 26);
  ctx.stroke();

  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  roundedRect(
    ctx,
    width - padding - 250,
    padding + 30,
    220,
    52,
    999,
    "rgba(15, 23, 42, 0.72)"
  );
  ctx.strokeStyle = `${tierMeta.accentA}88`;
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, width - padding - 250, padding + 30, 220, 52, 999);
  ctx.stroke();
  ctx.fillStyle = tierMeta.accentText;
  ctx.font = "700 26px Inter, Arial, sans-serif";
  ctx.fillText(tierMeta.label, width - padding - 220, padding + 64);

  const textStartX = coverX + coverW + 34;
  const titleY = 412;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 52px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    game.title,
    textStartX,
    titleY,
    width - padding - textStartX,
    60,
    3
  );

  ctx.fillStyle = "#b7f7de";
  ctx.font = "600 24px Inter, Arial, sans-serif";
  const contextFinishText = `${game.platform || "Unspecified"} • Completed ${formatDate(
    game.completedAt || game.updatedAt
  )}`;
  ctx.fillText(contextFinishText, textStartX, 556);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 22px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    tierMeta.subtitle,
    textStartX,
    596,
    width - padding - textStartX,
    30,
    2
  );

  const statsTop = 620;
  const statBoxW = (width - padding * 2 - 24) / 2;
  const statBoxH = 104;
  const statRows = [
    ["Total time", formatMinutes(stats.totalMinutes)],
    ["Sessions", String(stats.sessionCount)],
    ["Meaningful sessions", String(stats.meaningfulCount)],
    ["Goal XP", String(totalQuestXp)],
  ];

  statRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const boxX = padding + col * (statBoxW + 24);
    const boxY = statsTop + row * (statBoxH + 20);

    roundedRect(ctx, boxX, boxY, statBoxW, statBoxH, 22, "rgba(15, 23, 42, 0.7)");
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundedRectPath(ctx, boxX, boxY, statBoxW, statBoxH, 22);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 18px Inter, Arial, sans-serif";
    ctx.fillText(label, boxX + 20, boxY + 34);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 34px Inter, Arial, sans-serif";
    ctx.fillText(value, boxX + 20, boxY + 74);
  });

  const noteText =
    getGameObjectiveText(game) ||
    stats.latestSession?.note?.trim() ||
    "That completion counts. Keep building your completed goals one by one.";

  const noteBoxY = 890;
  roundedRect(
    ctx,
    padding,
    noteBoxY,
    width - padding * 2,
    210,
    28,
    "rgba(15, 23, 42, 0.68)"
  );
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundedRectPath(ctx, padding, noteBoxY, width - padding * 2, 210, 28);
  ctx.stroke();

  ctx.fillStyle = tierMeta.accentText;
  ctx.font = "700 20px Inter, Arial, sans-serif";
  ctx.fillText("Goal note", padding + 24, noteBoxY + 42);

  ctx.fillStyle = "#dbeafe";
  ctx.font = "500 24px Inter, Arial, sans-serif";
  wrapCanvasText(
    ctx,
    noteText,
    padding + 24,
    noteBoxY + 82,
    width - padding * 2 - 48,
    34,
    4
  );

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 18px Inter, Arial, sans-serif";
  ctx.fillText("Goal Tracker • Completion Card", padding, height - 54);
  ctx.textAlign = "right";
  ctx.fillText(formatDate(new Date().toISOString()), width - padding, height - 54);
  ctx.textAlign = "left";

  return canvas;
}

export function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export function drawCanvasGlow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function roundedRect(ctx, x, y, width, height, radius, fillStyle) {
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

export function roundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

export function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;

  const lines = [];
  let line = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const testLine = `${line} ${words[index]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      line = testLine;
    } else {
      lines.push(line);
      line = words[index];
    }
  }

  lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[visibleLines.length - 1];
    while (ctx.measureText(`${lastLine}…`).width > maxWidth && lastLine.length) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[visibleLines.length - 1] = `${lastLine}…`;
  }

  visibleLines.forEach((currentLine, index) => {
    ctx.fillText(currentLine, x, y + index * lineHeight);
  });

  return y + (visibleLines.length - 1) * lineHeight;
}
