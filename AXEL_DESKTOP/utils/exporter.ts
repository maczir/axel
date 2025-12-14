import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { BomItem, WiringRow, SystemState } from '../types';
import { LAYOUT } from '../constants';

interface ExportData {
  bom: BomItem[];
  wiring: WiringRow[];
  siteName: string;
  system: SystemState;
}

interface CapturedImage {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
  logicalHeight: number; // The height in CSS pixels (unscaled)
  blob: Blob;
}

const isElectron = () => typeof window !== 'undefined' && Boolean((window as any).axel?.saveFile);

const captureDiagram = async (): Promise<CapturedImage | null> => {
  const svg = document.getElementById('diagram-svg') as SVGSVGElement | null;
  if (!svg) return null;

  const cloned = svg.cloneNode(true) as SVGSVGElement;
  const width = Number(cloned.getAttribute('width') || LAYOUT.CANVAS_WIDTH);
  const height = Number(cloned.getAttribute('height') || LAYOUT.CANVAS_WIDTH);

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(cloned);
  const blobSvg = new Blob([
    '<?xml version="1.0" encoding="UTF-8"?>',
    source
  ], { type: 'image/svg+xml;charset=utf-8' });

  const url = URL.createObjectURL(blobSvg);
  const img = new Image();

  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });
  img.src = url;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  const pngBlob: Blob = await new Promise(resolve => {
    canvas.toBlob(b => resolve(b || new Blob()), 'image/png');
  });

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    logicalHeight: height,
    blob: pngBlob
  };
};

// Helper to get Y positions of all racks to define cut points
const getRackYPositions = (system: SystemState) => {
    let currentY = LAYOUT.AMIA_START_Y;
    const positions: number[] = [];

    system.racks.forEach(rack => {
        positions.push(currentY);
        const externals = rack.slots.filter(s => ['NODEBOX', 'FPBA', 'FPRB', 'FPBC'].includes(s.name));
        const rackContentHeight = LAYOUT.AMIA_CHASSIS_HEIGHT + 20 + (externals.length * 60);
        currentY += rackContentHeight + LAYOUT.AMIA_GAP;
    });
    return positions;
}

// Helper to slice the large canvas into a sub-image for a specific rack
const sliceCanvas = (sourceCanvas: HTMLCanvasElement, yStart: number, yEnd: number, logicalTotalWidth: number): string => {
   // Calculate scale factor between logical pixels (CSS) and actual canvas pixels
   const scale = sourceCanvas.width / logicalTotalWidth;

   const sy = Math.max(0, yStart * scale);
   const sh = (yEnd * scale) - sy;

   if (sh <= 0) return sourceCanvas.toDataURL('image/png'); // Fallback

   const destCanvas = document.createElement('canvas');
   destCanvas.width = sourceCanvas.width;
   destCanvas.height = sh;

   const ctx = destCanvas.getContext('2d');
   if (!ctx) return '';

   ctx.fillStyle = '#FFFFFF';
   ctx.fillRect(0, 0, destCanvas.width, destCanvas.height);

   // Draw only the slice
   ctx.drawImage(sourceCanvas, 0, sy, sourceCanvas.width, sh, 0, 0, destCanvas.width, sh);

   return destCanvas.toDataURL('image/png');
}

const saveBinary = async (blob: Blob, filename: string, filters?: Array<{ name: string; extensions: string[] }>) => {
  if (isElectron()) {
    const buffer = await blob.arrayBuffer();
    await (window as any).axel.saveFile({ data: buffer, defaultPath: filename, filters });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToImage = async (filename: string) => {
  const capture = await captureDiagram();
  if (!capture) return;
  await saveBinary(capture.blob, `${filename}.png`, [{ name: 'Images', extensions: ['png'] }]);
};

export const exportToPDF = async (data: ExportData) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString();

  // --- Title Page ---
  // Brand
  doc.setFontSize(24);
  doc.setTextColor(206, 0, 51); // Free Red
  doc.text("AXEL", 14, 20);

  // Subtitle (Full Name)
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("AirScale Xpert Engineering Layout", 14, 27);

  // Maquettage Info
  doc.setFontSize(18);
  doc.setTextColor(60, 60, 60);
  // Replaces "Rapport Technique" with requested format
  doc.text(`Maquettage : ${data.siteName}`, 14, 40);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Nombre de Baies: ${data.system.racks.length}`, 14, 50);

  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Généré le ${dateStr}`, 14, 200);

  // --- Diagram Pages (One per Rack) ---
  const capture = await captureDiagram();

  if (capture) {
    const rackY = getRackYPositions(data.system);
    const logicalWidth = LAYOUT.CANVAS_WIDTH;

    data.system.racks.forEach((rack, index) => {
        doc.addPage();

        // Header
        doc.setFontSize(16);
        doc.setTextColor(206, 0, 51);
        doc.text(`Schéma - Baie ${rack.bayId} (AMIA ${rack.id})`, 14, 15);

        // Determine slice coordinates
        const currentY = rackY[index];
        const nextY = rackY[index + 1];

        const sliceStart = index === 0 ? 0 : currentY - (LAYOUT.AMIA_GAP / 2);
        const sliceEnd = nextY ? nextY - (LAYOUT.AMIA_GAP / 2) : capture.logicalHeight;

        const slicedDataUrl = sliceCanvas(capture.canvas, sliceStart, sliceEnd, logicalWidth);

        // Add to PDF
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;

        // Get dimensions of the slice
        const sliceLogicalHeight = sliceEnd - sliceStart;
        const ratio = logicalWidth / sliceLogicalHeight;

        const availW = pageWidth - (margin * 2);
        const availH = pageHeight - 30;

        let displayW = availW;
        let displayH = displayW / ratio;

        if (displayH > availH) {
            displayH = availH;
            displayW = displayH * ratio;
        }

        const x = (pageWidth - displayW) / 2;
        const y = 25;

        doc.addImage(slicedDataUrl, 'PNG', x, y, displayW, displayH);
    });
  } else {
    doc.text("Diagramme non disponible", 14, 70);
  }

  // --- BOM Page ---
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text('Bill of Materials (BOM)', 14, 15);

  let y = 25;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Article", 14, y);
  doc.text("Description", 60, y);
  doc.text("Quantité", 260, y, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 280, y + 2);
  y += 10;
  doc.setFont("helvetica", "normal");

  data.bom.forEach((item) => {
     if (y > 190) { doc.addPage(); y = 20; }
     doc.text(item.part, 14, y);
     doc.text(item.description.substring(0, 90), 60, y);
     doc.text(item.qty.toString(), 260, y, { align: 'right' });
     y += 7;
  });

  // --- Wiring Page ---
  doc.addPage();
  doc.setFontSize(16);
  doc.text('Table de Câblage', 14, 15);

  y = 25;
  doc.setFontSize(8);
  const headers = ["Baie", "Rack", "Secteurs", "Bande", "Carte", "Port", "Type", "Distant", "Port Dist"];
  const xPos = [14, 25, 40, 65, 90, 120, 140, 180, 220];

  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => doc.text(h, xPos[i], y));
  doc.line(14, y + 2, 280, y + 2);
  y += 8;
  doc.setFont("helvetica", "normal");

  data.wiring.forEach((row) => {
     if (y > 190) {
        doc.addPage();
        y = 20;
        doc.setFont("helvetica", "bold");
        headers.forEach((h, i) => doc.text(h, xPos[i], y));
        doc.line(14, y + 2, 280, y + 2);
        y += 8;
        doc.setFont("helvetica", "normal");
     }
     doc.text(`${row.bay}`, xPos[0], y);
     doc.text(`AMIA ${row.rack}`, xPos[1], y);
     doc.text(row.sectors, xPos[2], y);
     doc.text(row.band, xPos[3], y);
     doc.text(row.card, xPos[4], y);
     doc.text(row.port.toString(), xPos[5], y);
     doc.text(row.cable, xPos[6], y);
     doc.text(row.remoteUnit, xPos[7], y);
     doc.text(row.remotePort, xPos[8], y);
     y += 6;
  });

  const pdfBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const safeName = data.siteName.replace(/[^a-z0-9]/gi, '_');
  await saveBinary(pdfBlob, `AXEL_${safeName}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const exportToPPTX = async (data: ExportData) => {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  // --- Slide 1: Title ---
  const slide1 = pres.addSlide();

  // Brand
  slide1.addText("AXEL", { x: 0.5, y: 1.5, fontSize: 44, bold: true, color: 'CE0033' });

  // Subtitle
  slide1.addText("AirScale Xpert Engineering Layout", { x: 0.5, y: 2.3, fontSize: 24, color: '888888' });

  // Maquettage Line
  slide1.addText(`Maquettage : ${data.siteName}`, { x: 0.5, y: 3.5, fontSize: 28, color: '363636' });

  slide1.addText(`Généré le: ${new Date().toLocaleDateString()}`, { x: 0.5, y: 4.5, fontSize: 14, color: 'AAAAAA' });

  // --- Diagram Slides (One per Rack) ---
  const capture = await captureDiagram();
  if (capture) {
     const rackY = getRackYPositions(data.system);
     const logicalWidth = LAYOUT.CANVAS_WIDTH;

     data.system.racks.forEach((rack, index) => {
         const slide = pres.addSlide();
         slide.addText(`Schéma de Câblage - Baie ${rack.bayId}`, { x: 0.5, y: 0.4, fontSize: 18, bold: true, color: 'CE0033' });

         const currentY = rackY[index];
         const nextY = rackY[index + 1];

         const sliceStart = index === 0 ? 0 : currentY - (LAYOUT.AMIA_GAP / 2);
         const sliceEnd = nextY ? nextY - (LAYOUT.AMIA_GAP / 2) : capture.logicalHeight;

         const slicedDataUrl = sliceCanvas(capture.canvas, sliceStart, sliceEnd, logicalWidth);

         const maxW = 9.5;
         const maxH = 4.5;

         const sliceLogicalHeight = sliceEnd - sliceStart;
         const ratio = logicalWidth / sliceLogicalHeight;

         let w = maxW;
         let h = w / ratio;

         if (h > maxH) {
             h = maxH;
             w = h * ratio;
         }

         const x = (10 - w) / 2;
         const y = 1.0 + (maxH - h) / 2;

         slide.addImage({ data: slicedDataUrl, x: x, y: y, w: w, h: h });
     });
  } else {
    const slide = pres.addSlide();
    slide.addText('Diagramme non disponible', { x: 1, y: 1, fontSize: 18 });
  }

  // --- BOM Slide ---
  const slide3 = pres.addSlide();
  slide3.addText("Bill of Materials (BOM)", { x: 0.5, y: 0.4, fontSize: 18, bold: true, color: 'CE0033' });
  const bomRows = data.bom.map(item => [item.part, item.description, item.qty]);
  slide3.addTable([['Article', 'Description', 'Quantité'], ...bomRows], {
    x: 0.5, y: 0.8, w: 9.0, fontSize: 11, rowH: 0.3,
    border: { pt: 0, color: "FFFFFF" }, autoPage: true,
    colProps: [{ w: 1.5 }, { w: 6.0 }, { w: 1.5, align: 'right' }],
    fill: { color: "FFFFFF" },
    headerStyles: { fill: { color: "F3F4F6" }, color: "1F2937", bold: true },
  });

  // --- Wiring Slide ---
  const slide4 = pres.addSlide();
  slide4.addText("Table de Câblage", { x: 0.5, y: 0.4, fontSize: 18, bold: true, color: 'CE0033' });
  const wiringRows = data.wiring.map(row => [
    row.bay, `AMIA ${row.rack}`, row.sectors, row.band, row.card, row.port, row.cable, row.remoteUnit, row.remotePort
  ]);
  slide4.addTable([
    ['Baie', 'Rack', 'Sec', 'Band', 'Carte', 'Port', 'Cable', 'RRU', 'Port'], ...wiringRows
  ], {
    x: 0.2, y: 0.8, w: 9.6, fontSize: 9, rowH: 0.3, autoPage: true,
    colProps: [{w:0.5}, {w:0.8}, {w:0.8}, {w:0.8}, {w:1.0}, {w:0.5}, {w:1.0}, {w:1.0}, {w:0.8}],
    border: { pt: 1, color: "E5E7EB" },
    headerStyles: { fill: { color: "1F2937" }, color: "FFFFFF", bold: true }
  });

  const pptxBuffer = await pres.write('arraybuffer');
  const safeName = data.siteName.replace(/[^a-z0-9]/gi, '_');
  const pptxBlob = new Blob([pptxBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  await saveBinary(pptxBlob, `AXEL_${safeName}.pptx`, [{ name: 'PowerPoint', extensions: ['pptx'] }]);
};
