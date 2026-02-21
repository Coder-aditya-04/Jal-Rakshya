/**
 * JalRakshya — Professional PDF Report Generator
 * Generates a multi-page, branded analytics report with:
 *   • Cover page with location & date
 *   • KPI summary section
 *   • High-quality chart captures (individual sections)
 *   • Natively rendered prediction table
 *   • Page headers, footers & page numbers
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// ── Brand Colours ────────────────────────────────────────────────
const BRAND = {
  primary: [59, 130, 246],   // #3B82F6  indigo-500
  primaryDk: [30, 64, 175],   // #1E40AF  indigo-800
  dark: [15, 23, 42],   // #0F172A  slate-900
  slate700: [51, 65, 85],   // #334155  slate-700
  slate500: [100, 116, 139],  // #64748B  slate-500
  slate300: [203, 213, 225],  // #CBD5E1  slate-300
  slate100: [241, 245, 249],  // #F1F5F9  slate-100
  white: [255, 255, 255],
  green: [34, 197, 94],   // #22C55E
  amber: [245, 158, 11],   // #F59E0B
  red: [239, 68, 68],   // #EF4444
};

// ── Layout constants (A4 portrait in mm) ─────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 14;
const FOOTER_H = 12;
const SAFE_TOP = MARGIN + HEADER_H + 4;
const SAFE_BOTTOM = PAGE_H - MARGIN - FOOTER_H;

// ── Helpers ──────────────────────────────────────────────────────
function rgb(arr) { return arr; }

function setFont(pdf, style = 'normal', size = 10) {
  pdf.setFont('helvetica', style);
  pdf.setFontSize(size);
}

function drawRect(pdf, x, y, w, h, color, radius = 0) {
  pdf.setFillColor(...color);
  if (radius > 0) {
    pdf.roundedRect(x, y, w, h, radius, radius, 'F');
  } else {
    pdf.rect(x, y, w, h, 'F');
  }
}

function drawLine(pdf, x1, y1, x2, y2, color = BRAND.slate300, width = 0.3) {
  pdf.setDrawColor(...color);
  pdf.setLineWidth(width);
  pdf.line(x1, y1, x2, y2);
}

/** Wrap text into lines that fit a given max width */
function wrapText(pdf, text, maxWidth) {
  return pdf.splitTextToSize(text, maxWidth);
}

// ── Page header (every page except cover) ────────────────────────
function drawPageHeader(pdf, locationName) {
  drawRect(pdf, 0, 0, PAGE_W, MARGIN + HEADER_H, BRAND.white);
  drawLine(pdf, MARGIN, MARGIN + HEADER_H, PAGE_W - MARGIN, MARGIN + HEADER_H, BRAND.slate300, 0.4);

  setFont(pdf, 'bold', 8);
  pdf.setTextColor(...BRAND.primary);
  pdf.text('JALRAKSHYA', MARGIN, MARGIN + 5);

  setFont(pdf, 'normal', 7);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text(`Groundwater Analytics Report  |  ${locationName}`, MARGIN + 28, MARGIN + 5);

  setFont(pdf, 'normal', 7);
  pdf.setTextColor(...BRAND.slate500);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  pdf.text(dateStr, PAGE_W - MARGIN, MARGIN + 5, { align: 'right' });
}

// ── Page footer ──────────────────────────────────────────────────
function drawPageFooter(pdf, pageNum, totalPages) {
  const y = PAGE_H - MARGIN - 2;
  drawLine(pdf, MARGIN, y, PAGE_W - MARGIN, y, BRAND.slate300, 0.3);

  setFont(pdf, 'normal', 7);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text('JalRakshya - Nashik District Groundwater Monitoring', MARGIN, y + 5);
  pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, y + 5, { align: 'right' });
}

// ── Cover page ───────────────────────────────────────────────────
function drawCoverPage(pdf, locationName, data, grade) {
  // Full-height dark header band
  drawRect(pdf, 0, 0, PAGE_W, 135, BRAND.dark);

  // Accent bar
  drawRect(pdf, MARGIN, 38, 50, 3, BRAND.primary, 1.5);

  // Title
  setFont(pdf, 'bold', 28);
  pdf.setTextColor(...BRAND.white);
  pdf.text('JalRakshya', MARGIN, 58);

  setFont(pdf, 'normal', 12);
  pdf.setTextColor(...BRAND.slate300);
  pdf.text('Groundwater Analytics Report', MARGIN, 68);

  // Location
  setFont(pdf, 'bold', 18);
  pdf.setTextColor(...BRAND.white);
  pdf.text(locationName, MARGIN, 92);

  // District line
  setFont(pdf, 'normal', 10);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text('Nashik District, Maharashtra, India', MARGIN, 102);

  // Date & period
  const dateStr = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  setFont(pdf, 'normal', 9);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text(`Generated on ${dateStr}`, MARGIN, 118);

  if (data.length > 0) {
    const yearRange = `Data Period: ${data[0].year} – ${data[data.length - 1].year}  (${data.length} records)`;
    pdf.text(yearRange, MARGIN, 126);
  }

  // ── Summary card below dark band ──
  const cardY = 148;
  drawRect(pdf, MARGIN, cardY, CONTENT_W, 56, BRAND.slate100, 4);
  drawRect(pdf, MARGIN, cardY, CONTENT_W, 2, BRAND.primary);

  setFont(pdf, 'bold', 11);
  pdf.setTextColor(...BRAND.dark);
  pdf.text('Report Summary', MARGIN + 8, cardY + 14);

  setFont(pdf, 'normal', 9);
  pdf.setTextColor(...BRAND.slate700);

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const summaryLines = [
    `Water Quality Grade: ${grade.grade} (${grade.label})`,
    latestData ? `Latest Water Level: ${latestData.groundwaterLevel?.toFixed(2)} m  |  Rainfall: ${latestData.rainfall?.toFixed(1)} mm` : '',
    latestData ? `Water Score: ${latestData.waterScore?.toFixed(1)} / 100  |  Depletion Rate: ${latestData.depletionRate?.toFixed(2)}%` : '',
    `This report contains trend analysis, forecasts, risk assessment, and actionable insights.`,
  ].filter(Boolean);

  summaryLines.forEach((line, i) => {
    pdf.text(line, MARGIN + 8, cardY + 24 + i * 7);
  });

  // ── Table of contents ──
  const tocY = 220;
  setFont(pdf, 'bold', 11);
  pdf.setTextColor(...BRAND.dark);
  pdf.text('Contents', MARGIN, tocY);
  drawLine(pdf, MARGIN, tocY + 2, MARGIN + 25, tocY + 2, BRAND.primary, 0.8);

  setFont(pdf, 'normal', 9);
  pdf.setTextColor(...BRAND.slate700);
  const tocItems = [
    '1.  Key Performance Indicators',
    '2.  Trend Indicators & Risk Assessment',
    '3.  Water Level & Rainfall Charts',
    '4.  Usage Analysis (Agricultural, Industrial, Household)',
    '5.  Forecasted Predictions',
    '6.  Smart Insights & Recommendations',
  ];
  tocItems.forEach((item, i) => {
    pdf.text(item, MARGIN + 4, tocY + 12 + i * 7);
  });

  // Bottom legal line
  setFont(pdf, 'normal', 7);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text(
    'Confidential — For authorized use only. Data sourced from Central Ground Water Board (CGWB) & Maharashtra Groundwater Survey.',
    PAGE_W / 2, PAGE_H - 20, { align: 'center' }
  );
}

// ── KPI Section ──────────────────────────────────────────────────
function drawKPISection(pdf, data, startY) {
  let y = startY;
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  if (!latestData) return y;

  setFont(pdf, 'bold', 13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text('1. Key Performance Indicators', MARGIN, y);
  drawLine(pdf, MARGIN, y + 2, MARGIN + 60, y + 2, BRAND.primary, 0.8);
  y += 10;

  // KPI Cards (2x3 grid)
  const kpis = [
    { label: 'Water Level', value: `${latestData.groundwaterLevel?.toFixed(2)} m`, color: BRAND.primary },
    { label: 'Rainfall', value: `${latestData.rainfall?.toFixed(1)} mm`, color: [20, 184, 166] },
    { label: 'Water Score', value: `${latestData.waterScore?.toFixed(1)} / 100`, color: BRAND.green },
    { label: 'Depletion Rate', value: `${latestData.depletionRate?.toFixed(2)}%`, color: BRAND.red },
    { label: 'Agricultural Use', value: `${latestData.agriculturalUsage?.toFixed(1)} Ml`, color: BRAND.amber },
    { label: 'Total Usage', value: `${((latestData.agriculturalUsage || 0) + (latestData.industrialUsage || 0) + (latestData.householdUsage || 0)).toFixed(1)} Ml`, color: [139, 92, 246] },
  ];

  const cardW = (CONTENT_W - 8) / 3;
  const cardH = 28;

  kpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = MARGIN + col * (cardW + 4);
    const cy = y + row * (cardH + 4);

    // Card bg
    drawRect(pdf, cx, cy, cardW, cardH, BRAND.white, 3);
    // Left accent
    drawRect(pdf, cx, cy + 3, 2.5, cardH - 6, kpi.color, 1);

    // Label
    setFont(pdf, 'normal', 7.5);
    pdf.setTextColor(...BRAND.slate500);
    pdf.text(kpi.label, cx + 8, cy + 10);

    // Value
    setFont(pdf, 'bold', 13);
    pdf.setTextColor(...BRAND.dark);
    pdf.text(kpi.value, cx + 8, cy + 21);
  });

  y += Math.ceil(kpis.length / 3) * (cardH + 4) + 6;

  // Light bg behind KPI section
  // (drawn under everything via ordering, skip for simplicity)

  return y;
}

// ── Historical Data Table ────────────────────────────────────────
function drawDataTable(pdf, data, startY, title = 'Historical Data Overview') {
  let y = startY;

  setFont(pdf, 'bold', 13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text(title, MARGIN, y);
  drawLine(pdf, MARGIN, y + 2, MARGIN + 50, y + 2, BRAND.primary, 0.8);
  y += 10;

  // Table header
  const cols = [
    { label: 'Year', width: 18, align: 'left' },
    { label: 'Water Lvl', width: 24, align: 'right' },
    { label: 'Rainfall', width: 24, align: 'right' },
    { label: 'Depletion', width: 24, align: 'right' },
    { label: 'Agri Use', width: 24, align: 'right' },
    { label: 'Ind. Use', width: 24, align: 'right' },
    { label: 'House Use', width: 24, align: 'right' },
    { label: 'Score', width: 16, align: 'right' },
  ];
  const totalTableW = cols.reduce((s, c) => s + c.width, 0);
  const tableX = MARGIN;
  const rowH = 7;

  // Header row
  drawRect(pdf, tableX, y, totalTableW, rowH + 1, BRAND.dark, 2);
  setFont(pdf, 'bold', 7);
  pdf.setTextColor(...BRAND.white);

  let cx = tableX + 3;
  cols.forEach((col) => {
    if (col.align === 'right') {
      pdf.text(col.label, cx + col.width - 3, y + 5, { align: 'right' });
    } else {
      pdf.text(col.label, cx, y + 5);
    }
    cx += col.width;
  });
  y += rowH + 1;

  // Rows
  setFont(pdf, 'normal', 7.5);
  data.forEach((d, i) => {
    if (y > SAFE_BOTTOM - 10) return; // leave room

    const isAlt = i % 2 === 0;
    if (isAlt) {
      drawRect(pdf, tableX, y, totalTableW, rowH, BRAND.slate100);
    }

    pdf.setTextColor(...BRAND.dark);
    cx = tableX + 3;

    const values = [
      String(d.year),
      `${d.groundwaterLevel?.toFixed(2)} m`,
      `${d.rainfall?.toFixed(1)} mm`,
      `${d.depletionRate?.toFixed(2)}%`,
      `${d.agriculturalUsage?.toFixed(1)} Ml`,
      `${d.industrialUsage?.toFixed(1)} Ml`,
      `${d.householdUsage?.toFixed(1)} Ml`,
      `${d.waterScore?.toFixed(0)}`,
    ];

    values.forEach((val, vi) => {
      const col = cols[vi];
      // Color-code score
      if (vi === values.length - 1) {
        const score = d.waterScore || 0;
        if (score >= 70) pdf.setTextColor(...BRAND.green);
        else if (score >= 50) pdf.setTextColor(...BRAND.amber);
        else pdf.setTextColor(...BRAND.red);
        setFont(pdf, 'bold', 7.5);
      } else if (vi === 0) {
        pdf.setTextColor(...BRAND.primary);
        setFont(pdf, 'bold', 7.5);
      } else {
        pdf.setTextColor(...BRAND.slate700);
        setFont(pdf, 'normal', 7.5);
      }

      if (col.align === 'right') {
        pdf.text(val, cx + col.width - 3, y + 5, { align: 'right' });
      } else {
        pdf.text(val, cx, y + 5);
      }
      cx += col.width;
    });

    y += rowH;
  });

  // Bottom border
  drawLine(pdf, tableX, y, tableX + totalTableW, y, BRAND.slate300, 0.3);
  y += 4;

  return y;
}

// ── Predictions Table ────────────────────────────────────────────
function drawPredictionTable(pdf, predictions, latestData, startY) {
  let y = startY;

  setFont(pdf, 'bold', 13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text('5. Forecasted Predictions (Linear Regression)', MARGIN, y);
  drawLine(pdf, MARGIN, y + 2, MARGIN + 80, y + 2, BRAND.primary, 0.8);
  y += 10;

  if (predictions.length === 0) {
    setFont(pdf, 'normal', 9);
    pdf.setTextColor(...BRAND.slate500);
    pdf.text('No prediction data available.', MARGIN, y);
    return y + 8;
  }

  const cols = [
    { label: 'Year', width: 22, align: 'left' },
    { label: 'Water Level (m)', width: 34, align: 'right' },
    { label: 'Rainfall (mm)', width: 34, align: 'right' },
    { label: 'Depletion (%)', width: 34, align: 'right' },
    { label: 'Trend', width: 30, align: 'right' },
  ];
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const rowH = 8;

  // Header
  drawRect(pdf, MARGIN, y, totalW, rowH + 1, BRAND.primaryDk, 2);
  setFont(pdf, 'bold', 7.5);
  pdf.setTextColor(...BRAND.white);
  let cx = MARGIN + 3;
  cols.forEach((col) => {
    if (col.align === 'right') {
      pdf.text(col.label, cx + col.width - 3, y + 6, { align: 'right' });
    } else {
      pdf.text(col.label, cx, y + 6);
    }
    cx += col.width;
  });
  y += rowH + 1;

  // Rows
  predictions.forEach((p, i) => {
    const isAlt = i % 2 === 0;
    if (isAlt) drawRect(pdf, MARGIN, y, totalW, rowH, BRAND.slate100);

    const prevLevel = i > 0 ? predictions[i - 1].groundwaterLevel : (latestData?.groundwaterLevel || 0);
    const trend = p.groundwaterLevel - prevLevel;
    const trendStr = `${trend > 0 ? '+' : ''}${trend.toFixed(2)} m`;

    const values = [
      String(p.year),
      p.groundwaterLevel?.toFixed(2),
      p.rainfall?.toFixed(1),
      p.depletionRate?.toFixed(2),
      trendStr,
    ];

    cx = MARGIN + 3;
    values.forEach((val, vi) => {
      const col = cols[vi];
      if (vi === 0) {
        setFont(pdf, 'bold', 8);
        pdf.setTextColor(...BRAND.primary);
      } else if (vi === 4) {
        setFont(pdf, 'bold', 8);
        pdf.setTextColor(...(trend > 0 ? BRAND.red : BRAND.green));
      } else {
        setFont(pdf, 'normal', 8);
        pdf.setTextColor(...BRAND.slate700);
      }
      if (col.align === 'right') {
        pdf.text(val, cx + col.width - 3, y + 6, { align: 'right' });
      } else {
        pdf.text(val, cx, y + 6);
      }
      cx += col.width;
    });
    y += rowH;
  });

  drawLine(pdf, MARGIN, y, MARGIN + totalW, y, BRAND.slate300, 0.3);
  y += 3;

  setFont(pdf, 'italic', 7);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text('Predictions are based on linear regression modelling. Values are indicative and subject to change.', MARGIN, y + 3);
  y += 10;

  return y;
}

// ── Capture a DOM node as a high-res image ───────────────────────
async function captureElement(el, darkMode) {
  const canvas = await html2canvas(el, {
    scale: 2, // Reduced from 3 to prevent mobile crashes
    useCORS: true,
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    logging: false,
    allowTaint: true,
  });
  return canvas.toDataURL('image/png');
}

// ── Add chart image to PDF (auto-paginates) ──────────────────────
function addChartImage(pdf, imgData, y, maxHeight = 85) {
  // Get image aspect ratio from html2canvas
  const img = new Image();
  img.src = imgData;

  const availW = CONTENT_W;
  // We use a fixed max height; width scales accordingly
  const imgW = availW;
  const imgH = maxHeight;

  if (y + imgH > SAFE_BOTTOM) {
    pdf.addPage();
    y = SAFE_TOP;
  }

  pdf.addImage(imgData, 'PNG', MARGIN, y, imgW, imgH);
  return y + imgH + 6;
}

// ── Section title helper ─────────────────────────────────────────
function drawSectionTitle(pdf, title, y) {
  if (y + 20 > SAFE_BOTTOM) {
    pdf.addPage();
    y = SAFE_TOP;
  }
  setFont(pdf, 'bold', 13);
  pdf.setTextColor(...BRAND.dark);
  pdf.text(title, MARGIN, y);
  drawLine(pdf, MARGIN, y + 2, MARGIN + 60, y + 2, BRAND.primary, 0.8);
  return y + 10;
}

// ═══════════════════════════════════════════════════════════════════
// ██  MAIN EXPORT FUNCTION  ██
// ═══════════════════════════════════════════════════════════════════
export async function generateReport({
  locationName,
  data,
  predictions,
  grade,
  darkMode,
  reportRef,
}) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  // ───────── PAGE 1: COVER ─────────
  drawCoverPage(pdf, locationName, data, grade);

  // ───────── PAGE 2: KPIs + Historical Table ─────────
  pdf.addPage();
  let y = SAFE_TOP;
  drawPageHeader(pdf, locationName);
  y = drawKPISection(pdf, data, y);
  y += 4;
  y = drawDataTable(pdf, data, y, '2. Historical Data Overview');

  // ───────── PAGE 3: Summary Notes (No html2canvas — prevents crash) ─────────
  pdf.addPage();
  y = SAFE_TOP;
  drawPageHeader(pdf, locationName);
  y = drawSectionTitle(pdf, '3. Key Analytics Summary', y);

  // Water Level trend
  if (data.length >= 2) {
    const first = data[0];
    const last = data[data.length - 1];
    const wlChange = last.groundwaterLevel - first.groundwaterLevel;
    const rainChange = last.rainfall - first.rainfall;
    const deplChange = last.depletionRate - first.depletionRate;

    const summaryItems = [
      { label: 'Water Level Trend', value: `${wlChange > 0 ? '↑ Rising' : '↓ Falling'} by ${Math.abs(wlChange).toFixed(2)} m (${first.year}–${last.year})`, color: wlChange > 0 ? BRAND.red : BRAND.green },
      { label: 'Rainfall Trend', value: `${rainChange > 0 ? '↑ Increasing' : '↓ Decreasing'} by ${Math.abs(rainChange).toFixed(1)} mm`, color: rainChange > 0 ? BRAND.green : BRAND.amber },
      { label: 'Depletion Rate', value: `${deplChange > 0 ? '↑ Worsening' : '↓ Improving'} by ${Math.abs(deplChange).toFixed(2)}%`, color: deplChange > 0 ? BRAND.red : BRAND.green },
      { label: 'Water Quality Grade', value: `${grade.grade} — ${grade.label}`, color: BRAND.primary },
      { label: 'Data Coverage', value: `${data.length} year(s) of monitoring data`, color: BRAND.slate500 },
    ];

    const cardW = CONTENT_W;
    const cardH = 22;
    summaryItems.forEach((item, i) => {
      const cy = y + i * (cardH + 3);
      drawRect(pdf, MARGIN, cy, cardW, cardH, BRAND.slate100, 3);
      drawRect(pdf, MARGIN, cy, 4, cardH, item.color, 2);
      setFont(pdf, 'bold', 8.5);
      pdf.setTextColor(...BRAND.slate700);
      pdf.text(item.label, MARGIN + 10, cy + 9);
      setFont(pdf, 'normal', 8.5);
      pdf.setTextColor(...item.color);
      pdf.text(item.value, MARGIN + 10, cy + 16);
    });
    y += summaryItems.length * (cardH + 3) + 8;
  }

  // Usage breakdown section
  y = drawSectionTitle(pdf, '4. Water Usage Breakdown', y);
  const usageCols = [
    { label: 'Year', width: 20, align: 'left' },
    { label: 'Agri. (Ml)', width: 36, align: 'right' },
    { label: 'Industry (Ml)', width: 40, align: 'right' },
    { label: 'Household (Ml)', width: 44, align: 'right' },
    { label: 'Total (Ml)', width: 36, align: 'right' },
  ];
  const usageTotal = usageCols.reduce((s, c) => s + c.width, 0);
  const rowH2 = 7;
  drawRect(pdf, MARGIN, y, usageTotal, rowH2 + 1, BRAND.dark, 2);
  setFont(pdf, 'bold', 7);
  pdf.setTextColor(...BRAND.white);
  let ucx = MARGIN + 3;
  usageCols.forEach((col) => {
    if (col.align === 'right') pdf.text(col.label, ucx + col.width - 3, y + 5, { align: 'right' });
    else pdf.text(col.label, ucx, y + 5);
    ucx += col.width;
  });
  y += rowH2 + 1;

  data.forEach((d, i) => {
    if (y > SAFE_BOTTOM - 10) return;
    if (i % 2 === 0) drawRect(pdf, MARGIN, y, usageTotal, rowH2, BRAND.slate100);
    const total = ((d.agriculturalUsage || 0) + (d.industrialUsage || 0) + (d.householdUsage || 0)).toFixed(1);
    const vals = [String(d.year), `${d.agriculturalUsage?.toFixed(1)}`, `${d.industrialUsage?.toFixed(1)}`, `${d.householdUsage?.toFixed(1)}`, total];
    ucx = MARGIN + 3;
    setFont(pdf, 'normal', 7.5);
    pdf.setTextColor(...BRAND.slate700);
    vals.forEach((val, vi) => {
      const col = usageCols[vi];
      if (vi === 0) { setFont(pdf, 'bold', 7.5); pdf.setTextColor(...BRAND.primary); }
      else { setFont(pdf, 'normal', 7.5); pdf.setTextColor(...BRAND.slate700); }
      if (col.align === 'right') pdf.text(val, ucx + col.width - 3, y + 5, { align: 'right' });
      else pdf.text(val, ucx, y + 5);
      ucx += col.width;
    });
    y += rowH2;
  });
  y += 6;

  // ───────── PAGE 4: Chart Images (native canvas capture — no html2canvas!) ─────────
  if (reportRef?.current) {
    // Grab all <canvas> elements inside chart containers — these are Chart.js rendered canvases
    const allCanvases = reportRef.current.querySelectorAll('.chart-container canvas, [class*="chart"] canvas');

    if (allCanvases.length > 0) {
      pdf.addPage();
      y = SAFE_TOP;
      drawPageHeader(pdf, locationName);
      y = drawSectionTitle(pdf, `${data.length >= 2 ? '5' : '3'}. Detailed Charts & Analysis`, y);

      for (let i = 0; i < allCanvases.length; i++) {
        try {
          const canvas = allCanvases[i];
          // Skip tiny or hidden canvases
          if (canvas.width < 50 || canvas.height < 50) continue;

          // Get image directly from the canvas — zero memory overhead!
          const imgData = canvas.toDataURL('image/png', 0.92);

          // Calculate proper aspect ratio
          const aspectRatio = canvas.height / canvas.width;
          const imgW = CONTENT_W;
          const imgH = Math.min(imgW * aspectRatio, 85);

          // Page break if needed
          if (y + imgH + 10 > SAFE_BOTTOM) {
            pdf.addPage();
            y = SAFE_TOP;
            drawPageHeader(pdf, locationName);
          }

          // Dark background card for chart
          drawRect(pdf, MARGIN, y, CONTENT_W, imgH + 6, darkMode ? [15, 23, 42] : [248, 250, 252], 4);

          // Add the chart image
          pdf.addImage(imgData, 'PNG', MARGIN + 3, y + 3, imgW - 6, imgH);
          y += imgH + 12;
        } catch (err) {
          console.warn('Canvas capture skipped:', err);
        }
      }
    }
  }

  // ───────── PREDICTION TABLE PAGE ─────────
  pdf.addPage();
  y = SAFE_TOP;
  drawPageHeader(pdf, locationName);

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  y = drawPredictionTable(pdf, predictions, latestData, y);

  // ───────── INSIGHTS / DISCLAIMER PAGE ─────────
  y += 4;
  y = drawSectionTitle(pdf, '6. Notes & Disclaimer', y);

  setFont(pdf, 'normal', 8.5);
  pdf.setTextColor(...BRAND.slate700);

  const notes = [
    'This report has been auto-generated by the JalRakshya Groundwater Monitoring System using data sourced',
    'from the Central Ground Water Board (CGWB) and Maharashtra State Groundwater Survey & Development Agency.',
    '',
    'Key Observations:',
    `  •  Data covers ${data.length} year(s) of monitoring for ${locationName}.`,
    `  •  Current water quality is graded "${grade.grade}" (${grade.label}).`,
    latestData ? `  •  Latest depletion rate stands at ${latestData.depletionRate?.toFixed(2)}%, which requires ${latestData.depletionRate > 1.5 ? 'immediate attention' : 'ongoing monitoring'}.` : '',
    '',
    'Disclaimer:',
    '  The predictions and insights in this report are generated using statistical models (linear regression).',
    '  They are indicative and should not be used as the sole basis for policy decisions. Always consult local',
    '  hydrogeological experts and the latest CGWB reports for authoritative guidance.',
    '',
    'For more information, visit: https://cgwb.gov.in  |  https://gsda.maharashtra.gov.in',
  ].filter((l) => l !== undefined);

  notes.forEach((line) => {
    if (y > SAFE_BOTTOM - 5) {
      pdf.addPage();
      y = SAFE_TOP;
      drawPageHeader(pdf, locationName);
    }
    pdf.text(line, MARGIN, y);
    y += 5;
  });

  // ── Stamp at bottom ──
  y += 8;
  drawRect(pdf, MARGIN, y, CONTENT_W, 18, BRAND.slate100, 3);
  setFont(pdf, 'bold', 8);
  pdf.setTextColor(...BRAND.primary);
  pdf.text('JalRakshya', MARGIN + 6, y + 8);
  setFont(pdf, 'normal', 7);
  pdf.setTextColor(...BRAND.slate500);
  pdf.text(`Report generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })} at ${new Date().toLocaleTimeString('en-IN')}`, MARGIN + 6, y + 14);

  // ── Add footers to all pages ──
  const totalPages = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    if (p > 1) {
      drawPageFooter(pdf, p - 1, totalPages - 1); // cover page not counted
    }
  }

  // ── Platform-aware Save ──
  const fileName = `JalRakshya_${locationName}_Report.pdf`;

  if (Capacitor.isNativePlatform()) {
    // Android/iOS: Multiple fallback strategies
    try {
      // Strategy 1: Write to Cache dir (always writable, no permissions needed)
      const pdfArrayBuffer = pdf.output('arraybuffer');
      const pdfBytes = new Uint8Array(pdfArrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < pdfBytes.length; i++) {
        binaryStr += String.fromCharCode(pdfBytes[i]);
      }
      const pdfBase64 = btoa(binaryStr);

      const result = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache,
        recursive: true,
      });

      // Share the file so user can save/open it
      await Share.share({
        title: `JalRakshya Report – ${locationName}`,
        text: 'Your groundwater analytics report is ready.',
        url: result.uri,
        dialogTitle: 'Save or share the report',
      });
    } catch (err) {
      console.error('Capacitor save error:', err);
      try {
        // Strategy 2: Try Documents directory
        const pdfArrayBuffer2 = pdf.output('arraybuffer');
        const pdfBytes2 = new Uint8Array(pdfArrayBuffer2);
        let binaryStr2 = '';
        for (let i = 0; i < pdfBytes2.length; i++) {
          binaryStr2 += String.fromCharCode(pdfBytes2[i]);
        }
        const pdfBase642 = btoa(binaryStr2);

        await Filesystem.writeFile({
          path: fileName,
          data: pdfBase642,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`Report saved to Documents/${fileName}`);
      } catch (err2) {
        console.error('Documents save error:', err2);
        // Strategy 3: Blob download (works in WebView)
        try {
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err3) {
          console.error('Blob download error:', err3);
          // Strategy 4: Last resort — jsPDF native save
          pdf.save(fileName);
        }
      }
    }
  } else {
    // Web/browser: standard download
    pdf.save(fileName);
  }
}
