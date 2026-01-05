// src/pdf/generatePacket.js
import { PDFDocument, StandardFonts } from "pdf-lib";

// Vite will bundle these into /assets and give us a correct URL (works locally + WP plugin)
import e100_post_url from "./templates/AOC-E-100_7-24.pdf?url"; // your Rev 1/26 file renamed to _7-24
import e100_pre_url from "./templates/AOC-E-100_9-21.pdf?url";
import e101_url from "./templates/AOC-E-101.pdf?url";

const SPOUSE_ALLOWANCE = 60000;
const MARCH_1_2024 = new Date("2024-03-01");

// ─────────────────────────────────────────────────────────────
// QUICK TUNING KNOBS (PDF-LIB COORDS: +Y moves UP, -Y moves DOWN)
// If you're "close but not perfect", tweak these by 2–8 points.
// ─────────────────────────────────────────────────────────────
const TUNE = {
  E100_P1_DX: 0,
  E100_P1_DY: +6, // page 1 slightly UP

  E100_P3_DX: 0,
  E100_P3_DY: +4, // assignment page slightly UP

  E101_P1_DX: 0,
  E101_P1_DY: +6, // deficiency form slightly UP
};

function money(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-US");
}

function mmddyyyy(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch template: ${url}`);
  return await res.arrayBuffer();
}

function draw(page, font, text, x, y, size = 11) {
  if (!text) return;
  page.drawText(String(text), { x, y, size, font });
}

function fullSpouseAddress(form) {
  const parts = [];
  if (form.spouseAddress) parts.push(form.spouseAddress);
  const cityLine = [form.spouseCity, form.spouseState, form.spouseZip]
    .filter(Boolean)
    .join(" ");
  if (cityLine) parts.push(cityLine);
  return parts.join(", ");
}

function getAssignedLines(form) {
  // only assets with assigned amount > 0
  const lines = [];
  const assetsById = new Map((form.assets || []).map((a) => [a.id, a]));

  for (const [id, amtRaw] of Object.entries(form.assigned || {})) {
    const amt = Number(amtRaw) || 0;
    if (amt <= 0) continue;
    const a = assetsById.get(id);
    if (!a) continue;

    const desc = (a.description || "").trim() || "Asset";
    const loc = (a.location || "").trim();
    const left = loc ? `${desc} — ${loc}` : desc;

    lines.push({
      left,
      value: amt,
    });
  }
  return lines;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Main generator: returns a PDF Blob
export async function generatePacket(form) {
  const isPost = form?.dateOfDeath
    ? new Date(form.dateOfDeath) >= MARCH_1_2024
    : true;

  // pick which E-100 template to use
  const e100Bytes = await fetchBytes(isPost ? e100_post_url : e100_pre_url);
  const e101Bytes = await fetchBytes(e101_url);

  const e100Doc = await PDFDocument.load(e100Bytes);
  const e101Doc = await PDFDocument.load(e101Bytes);

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);

  // Copy E-100 pages into output
  const e100Pages = await out.copyPages(e100Doc, e100Doc.getPageIndices());
  e100Pages.forEach((p) => out.addPage(p));

  // ─────────────────────────────────────────────────────────────
  // Compute totals
  // ─────────────────────────────────────────────────────────────
  const assignedLines = getAssignedLines(form);
  const totalAssigned = assignedLines.reduce(
    (s, r) => s + (Number(r.value) || 0),
    0
  );
  const deficiency = Math.max(0, SPOUSE_ALLOWANCE - totalAssigned);

  // ─────────────────────────────────────────────────────────────
  // E-100 PAGE 1 (index 0): Petition/Application page
  // Coordinates tuned for your Rev 1/26 layout (renamed as _7-24).
  // ─────────────────────────────────────────────────────────────
  {
    const p = out.getPage(0);
    const dx = TUNE.E100_P1_DX;
    const dy = TUNE.E100_P1_DY;

    // Header (county / file no)
    draw(p, font, form.county || "", 125 + dx, 720 + dy, 11);
    draw(p, font, form.fileNumber || "", 430 + dx, 748 + dy, 11);

    // Decedent + DOD
    draw(p, font, form.decedentName || "", 85 + dx, 668 + dy, 11);
    draw(p, font, mmddyyyy(form.dateOfDeath), 85 + dx, 628 + dy, 11);

    // SPOUSE ENTITLED table row (name + address columns)
    draw(p, font, form.spouseName || "", 115 + dx, 367 + dy, 11);
    draw(p, font, fullSpouseAddress(form), 330 + dx, 367 + dy, 11);

    // Petitioner name/address block near bottom
    const petitionerBlock = [form.spouseName, fullSpouseAddress(form)]
      .filter(Boolean)
      .join("\n");

    if (petitionerBlock) {
      const startX = 45 + dx;
      let y = 88 + dy;
      for (const line of petitionerBlock.split("\n")) {
        draw(p, font, line, startX, y, 11);
        y -= 14;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // E-100 ASSIGNMENT TABLE PAGE
  // In your packet this is page index 2 (third page).
  // ─────────────────────────────────────────────────────────────
  if (out.getPageCount() >= 3) {
    const p = out.getPage(2);
    const dx = TUNE.E100_P3_DX;
    const dy = TUNE.E100_P3_DY;

    // Header on assignment page
    draw(p, font, form.decedentName || "", 45 + dx, 742 + dy, 10);
    draw(p, font, form.county || "", 250 + dx, 740 + dy, 10);
    draw(p, font, form.fileNumber || "", 460 + dx, 742 + dy, 10);

    // Table rows
    let rowY = 598 + dy; // first row baseline
    const rowGap = 18;
    const leftX = 55 + dx;
    const valX = 505 + dx; // tweak if value column slightly off

    for (let i = 0; i < Math.min(assignedLines.length, 18); i++) {
      const r = assignedLines[i];
      draw(p, font, r.left, leftX, rowY, 10);
      draw(p, font, `$${money(r.value)}`, valX, rowY, 10);
      rowY -= rowGap;
    }

    // Totals near bottom right of table
    draw(p, font, `$${money(totalAssigned)}`, 505 + dx, 200 + dy, 10);
    if (deficiency > 0) {
      draw(p, font, `$${money(deficiency)}`, 505 + dx, 176 + dy, 10);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // If deficiency: append E-101 and fill it
  // ─────────────────────────────────────────────────────────────
  if (deficiency > 0) {
    const e101Pages = await out.copyPages(e101Doc, e101Doc.getPageIndices());
    const startIndex = out.getPageCount();
    e101Pages.forEach((p) => out.addPage(p));

    // E-101 page 1 is at startIndex
    const p = out.getPage(startIndex);
    const dx = TUNE.E101_P1_DX;
    const dy = TUNE.E101_P1_DY;

    // Header
    draw(p, font, form.county || "", 125 + dx, 720 + dy, 11);
    draw(p, font, form.fileNumber || "", 430 + dx, 748 + dy, 11);

    // Decedent name
    draw(p, font, form.decedentName || "", 85 + dx, 668 + dy, 11);

    // Petitioner name
    draw(p, font, form.spouseName || "", 85 + dx, 545 + dy, 11);

    // Total Allowed + Deficiency boxes
    draw(p, font, money(SPOUSE_ALLOWANCE), 70 + dx, 510 + dy, 11);
    draw(p, font, money(deficiency), 70 + dx, 485 + dy, 11);
  }

  const pdfBytes = await out.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

// App.jsx expects generatePdfPacket({ formState, eligibleAssets, formVer })
export async function generatePdfPacket({ formState /*, eligibleAssets, formVer */ }) {
  const blob = await generatePacket(formState);
  downloadBlob(blob, "NC-Years-Allowance-Packet.pdf");
}