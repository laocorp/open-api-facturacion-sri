import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SriRepositoryService } from './sri-repository.service';
import { EmisoresService } from '../../emisores/emisores.service';

const NAVY = rgb(0.06, 0.18, 0.34);
const BLUE = rgb(0.17, 0.43, 0.66);
const LIGHT_BLUE = rgb(0.85, 0.91, 0.96);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.2, 0.2, 0.2);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.88, 0.88, 0.88);
const BG_ROW = rgb(0.95, 0.97, 0.99);
const BORDER = rgb(0.7, 0.7, 0.7);
const MARGIN = 36;
const PAGE_W = 612;
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;

const FORMA_PAGO_MAP: Record<string, string> = {
  '01': 'Efectivo', '02': 'Cheque', '03': 'Transferencia',
  '04': 'Tarjeta Débito', '05': 'Tarjeta Crédito', '06': 'Dinero Electrónico',
  '07': 'Tarjeta Prepago', '08': 'Compensación', '09': 'Endoso de Títulos',
  '10': 'Otros', '20': 'Crédito', '21': 'Crédito Automotriz',
  '22': 'Crédito Inmobiliario', '23': 'Crédito Hipotecario',
  '24': 'Crédito Tarjeta', '25': 'Crédito Educativo',
  '26': 'Crédito Microcrédito', '27': 'Crédito Inversión',
  '28': 'Crédito Comercial', '30': 'Anticipo', '31': 'Saldo Anterior',
};

const TIPO_ID_MAP: Record<string, string> = {
  '01': 'Cédula', '02': 'RUC', '03': 'Pasaporte', '04': 'Consumidor Final',
  '05': 'Identificación Exterior', '06': 'Placa',
};

@Injectable()
export class FacturaPdfService {
  private readonly logger = new Logger(FacturaPdfService.name);

  constructor(
    private readonly repository: SriRepositoryService,
    private readonly emisoresService: EmisoresService,
  ) {}

  async generatePdf(claveAcceso: string): Promise<Buffer> {
    const comprobante = await this.repository.findComprobanteByClaveAcceso(claveAcceso);
    if (!comprobante || !comprobante.id) {
      throw new NotFoundException(`Comprobante ${claveAcceso} no encontrado`);
    }

    const emisor = await this.emisoresService.findOne(comprobante.emisor_id);
    const detalles = await this.repository.findDetallesByComprobanteId(comprobante.id);
    const pagos = await this.repository.findPagosByComprobanteId(comprobante.id);
    const totales = await this.repository.findTotalesByComprobanteId(comprobante.id);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdfDoc.embedFont(StandardFonts.Courier);

    let curPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const toNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
    const nf = (v: any) => toNum(v).toFixed(2);
    const checkSpace = (needed: number) => {
      if (y - needed < 60) {
        curPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    };
    const rect = (x: number, w: number, h: number, opts: any = {}) => {
      curPage.drawRectangle({ x, y: y - h, width: w, height: h, ...opts });
    };

    // ── HEADER: top bar + invoice metadata ──
    rect(MARGIN, CONTENT_W, 46, { color: NAVY });
    curPage.drawText('FACTURA ELECTRÓNICA', {
      x: MARGIN + 14, y: PAGE_H - MARGIN - 12, size: 14, font: bold, color: WHITE,
    });
    curPage.drawText('SRI - Ecuador', {
      x: MARGIN + 14, y: PAGE_H - MARGIN - 28, size: 8, font, color: WHITE,
    });

    const rucLabel = emisor?.ruc || comprobante.clave_acceso?.substring(10, 23) || '';
    const establecimiento = comprobante.clave_acceso?.substring(24, 27) || '';
    const puntoEmision = comprobante.clave_acceso?.substring(27, 30) || '';
    const secuencial = comprobante.secuencial || '';
    const numDoc = `${establecimiento}-${puntoEmision}-${secuencial}`;

    const metaX = MARGIN + CONTENT_W - 220;
    curPage.drawText(numDoc, { x: metaX, y: PAGE_H - MARGIN - 12, size: 14, font: bold, color: WHITE });
    curPage.drawText(`RUC: ${rucLabel}`, { x: metaX, y: PAGE_H - MARGIN - 28, size: 8, font, color: WHITE });
    const rawFecha = comprobante.fecha_emision as any;
    const fechaEmision = rawFecha instanceof Date
      ? rawFecha.toISOString().split('T')[0]
      : String(comprobante.fecha_emision || '');
    curPage.drawText(fechaEmision, { x: metaX, y: PAGE_H - MARGIN - 40, size: 8, font, color: WHITE });

    y = PAGE_H - MARGIN - 56;

    // ── METADATA ROW (Clave Acceso, Ambiente) ──
    checkSpace(24);
    rect(MARGIN, CONTENT_W, 24, { color: LIGHT_BLUE });
    curPage.drawText('CLAVE DE ACCESO', { x: MARGIN + 10, y: y - 10, size: 7, font: bold, color: GRAY });
    curPage.drawText(claveAcceso, { x: MARGIN + 10, y: y - 22, size: 8, font: mono, color: DARK_GRAY });
    const ambLabel = comprobante.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS';
    curPage.drawText(ambLabel, { x: MARGIN + CONTENT_W - 80, y: y - 16, size: 9, font: bold, color: BLUE });
    y -= 34;

    // ── SIDE-BY-SIDE: EMISOR | COMPRADOR ──
    checkSpace(95);
    const boxW = (CONTENT_W - 16) / 2;

    const drawInfoBox = (title: string, items: { label: string; value: string; boldLabel?: boolean }[], x: number) => {
      curPage.drawRectangle({ x, y: y - 74, width: boxW, height: 74, borderColor: LIGHT_GRAY, borderWidth: 1, color: WHITE });
      curPage.drawRectangle({ x, y: y - 16, width: boxW, height: 16, color: BLUE });
      curPage.drawText(title, { x: x + 8, y: y - 13, size: 8, font: bold, color: WHITE });

      let iy = y - 30;
      for (const item of items) {
        const label = item.boldLabel !== false ? `${item.label}: ` : item.label;
        const fontUsed = item.boldLabel !== false ? bold : font;
        curPage.drawText(label, { x: x + 8, y: iy, size: 7.5, font: fontUsed, color: BLACK });
        const lw = fontUsed.widthOfTextAtSize(label, 7.5);
        curPage.drawText(item.value, { x: x + 8 + lw, y: iy, size: 7.5, font, color: DARK_GRAY });
        iy -= 11;
      }
    };

    const emisorItems = [
      { label: emisor?.razonSocial || '', value: '', boldLabel: true },
      { label: 'RUC', value: rucLabel },
      { label: 'Dir', value: emisor?.direccionMatriz || '' },
    ];
    if (emisor?.obligadoContabilidad) {
      emisorItems.push({ label: '', value: 'Obligado a llevar contabilidad', boldLabel: false });
    }
    drawInfoBox('EMISOR', emisorItems, MARGIN);

    const compX = MARGIN + boxW + 16;
    const tipoId = comprobante.receptor_tipo_identificacion || '';
    const tipoLabel = TIPO_ID_MAP[tipoId] || tipoId;
    const compradorItems = [
      { label: comprobante.receptor_razon_social || '', value: '', boldLabel: true },
      { label: tipoLabel, value: comprobante.receptor_identificacion || '' },
      { label: 'Dirección', value: comprobante.receptor_direccion || '' },
    ];
    if (comprobante.receptor_telefono) {
      compradorItems.push({ label: 'Tel', value: comprobante.receptor_telefono, boldLabel: true });
    }
    drawInfoBox('COMPRADOR', compradorItems, compX);

    y -= 84;

    // ── ITEMS TABLE ──
    checkSpace(22);
    const cols = [
      { x: MARGIN, w: 20, h: '#', r: true },
      { x: MARGIN + 22, w: 64, h: 'Código', r: false },
      { x: MARGIN + 88, w: 220, h: 'Descripción', r: false },
      { x: MARGIN + 310, w: 42, h: 'Cant.', r: true },
      { x: MARGIN + 354, w: 60, h: 'P.Unit.', r: true },
      { x: MARGIN + 416, w: 46, h: 'Desc.', r: true },
      { x: MARGIN + 464, w: 112, h: 'Subtotal', r: true },
    ];
    const fullTableW = cols[cols.length - 1].x + cols[cols.length - 1].w - MARGIN;
    const rowH = 17;

    const drawTHead = () => {
      rect(MARGIN, fullTableW, 17, { color: NAVY });
      for (const c of cols) {
        if (c.r) {
          const tw = bold.widthOfTextAtSize(c.h, 8);
          curPage.drawText(c.h, { x: c.x + c.w - tw - 5, y: y - 12.5, size: 8, font: bold, color: WHITE });
        } else {
          curPage.drawText(c.h, { x: c.x + 5, y: y - 12.5, size: 8, font: bold, color: WHITE });
        }
      }
    };
    drawTHead();
    y -= rowH + 2;

    for (let i = 0; i < detalles.length; i++) {
      if (y < 80) {
        curPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        rect(MARGIN, fullTableW, 17, { color: NAVY });
        for (const c of cols) {
          if (c.r) {
            const tw = bold.widthOfTextAtSize(c.h, 8);
            curPage.drawText(c.h, { x: c.x + c.w - tw - 5, y: y - 12.5, size: 8, font: bold, color: WHITE });
          } else {
            curPage.drawText(c.h, { x: c.x + 5, y: y - 12.5, size: 8, font: bold, color: WHITE });
          }
        }
        y -= rowH + 2;
      }

      const d = detalles[i];
      rect(MARGIN, fullTableW, rowH, { color: i % 2 === 0 ? WHITE : BG_ROW });
      rect(MARGIN, fullTableW, rowH, { borderColor: LIGHT_GRAY, borderWidth: 0.5 });

      const desc = d.descripcion || '';
      const maxDesc = 72;
      const descLines = desc.length > maxDesc
        ? [desc.substring(0, maxDesc), desc.substring(maxDesc, maxDesc * 2)]
        : [desc];

      const vals = {
        '#': `${i + 1}`,
        'Código': d.codigo_principal || '',
        'Descripción': descLines[0],
        'Cant.': `${Number(d.cantidad) || 0}`,
        'P.Unit.': nf(d.precio_unitario),
        'Desc.': nf(d.descuento),
        'Subtotal': nf(d.subtotal),
      };

      for (const c of cols) {
        const txtV = (vals as any)[c.h];
        if (c.r) {
          const tw = font.widthOfTextAtSize(txtV, 8);
          curPage.drawText(txtV, { x: c.x + c.w - tw - 5, y: y - 12, size: 8, font, color: DARK_GRAY });
        } else {
          curPage.drawText(txtV, { x: c.x + 5, y: y - 12, size: 8, font, color: DARK_GRAY });
        }
      }

      y -= rowH;

      if (descLines.length > 1) {
        curPage.drawText(descLines[1], { x: cols[2].x + 5, y: y - 12, size: 7, font, color: GRAY });
        y -= 12;
      }
    }

    y -= 6;

    // ── TOTALS BOX (right side) ──
    checkSpace(90);
    const totW = 170;
    const totX = MARGIN + fullTableW - totW;
    const totH = 80;
    rect(totX, totW, totH, { borderColor: BLUE, borderWidth: 1, color: WHITE });

    let ty = y - 8;
    const totLine = (label: string, val: any, sz = 9, fb = font, fc = BLACK) => {
      const v = `$${nf(val)}`;
      const vw = fb.widthOfTextAtSize(v, sz);
      curPage.drawText(label, { x: totX + 10, y: ty, size: sz, font: fb, color: fc });
      curPage.drawText(v, { x: totX + totW - 10 - vw, y: ty, size: sz, font: fb, color: fc });
      ty -= sz + 5;
    };

    totLine('Subtotal', comprobante.total_sin_impuestos, 9, font, DARK_GRAY);

    for (const t of totales) {
      const pct = t.tarifa ? ` ${Number(t.tarifa).toFixed(2)}%` : '';
      const codPct = t.codigo_porcentaje || '';
      let label = 'Impuesto';
      if (t.codigo === '2') {
        const ivaLabels: Record<string, string> = { '0': 'IVA 0%', '2': 'IVA 12%', '3': 'IVA 14%', '4': 'IVA 15%', '6': 'IVA 15%' };
        label = ivaLabels[codPct] || `IVA${pct}`;
      }
      totLine(label, t.valor, 8, font, DARK_GRAY);
    }

    if (toNum(comprobante.total_descuento) > 0) {
      totLine('Descuento', comprobante.total_descuento, 8, font, DARK_GRAY);
    }
    if (toNum(comprobante.propina) > 0) {
      totLine('Propina', comprobante.propina, 8, font, DARK_GRAY);
    }

    ty -= 2;
    curPage.drawLine({ start: { x: totX + 10, y: ty }, end: { x: totX + totW - 10, y: ty }, thickness: 1.5, color: NAVY });
    ty -= 6;

    const totalV = `$${nf(comprobante.importe_total)}`;
    const totVw = bold.widthOfTextAtSize(totalV, 13);
    curPage.drawText('TOTAL', { x: totX + 10, y: ty, size: 13, font: bold, color: NAVY });
    curPage.drawText(totalV, { x: totX + totW - 10 - totVw, y: ty, size: 13, font: bold, color: NAVY });

    // ── PAYMENT INFO (left side) ──
    if (pagos.length > 0) {
      const payX = MARGIN;
      const payW = fullTableW - totW - 16;
      rect(payX, payW, totH, { borderColor: LIGHT_GRAY, borderWidth: 1, color: WHITE });

      let py = y - 8;
      curPage.drawText('Formas de Pago', { x: payX + 10, y: py, size: 9, font: bold, color: NAVY });
      py -= 16;

      for (const p of pagos) {
        const fpLabel = FORMA_PAGO_MAP[p.forma_pago] || p.forma_pago;
        const pv = `$${nf(p.total)}`;
        const pvw = font.widthOfTextAtSize(pv, 8);
        curPage.drawText(fpLabel, { x: payX + 10, y: py, size: 8, font, color: DARK_GRAY });
        curPage.drawText(pv, { x: payX + payW - 12 - pvw, y: py, size: 8, font, color: DARK_GRAY });
        py -= 13;
      }
    }

    y = 52;

    // ── FOOTER ──
    rect(MARGIN, CONTENT_W, 1, { color: LIGHT_GRAY });
    y -= 4;

    const authNum = comprobante.numero_autorizacion;
    const authDate = comprobante.fecha_autorizacion;

    if (authNum) {
      curPage.drawText('Autorización SRI:', { x: MARGIN, y: y - 9, size: 7, font: bold, color: NAVY });
      curPage.drawText(authNum, { x: MARGIN + 80, y: y - 9, size: 7, font: mono, color: DARK_GRAY });
      y -= 12;
    }
    if (authDate) {
      curPage.drawText('Fecha Autorización:', { x: MARGIN, y: y - 9, size: 7, font: bold, color: NAVY });
      const d = new Date(authDate).toLocaleString('es-EC', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' });
      curPage.drawText(d, { x: MARGIN + 85, y: y - 9, size: 7, font, color: DARK_GRAY });
      y -= 12;
    }
    if (emisor?.nombreComercial) {
      curPage.drawText(`Contribuyente: ${emisor.nombreComercial}`, { x: MARGIN, y: y - 9, size: 7, font, color: GRAY });
      y -= 12;
    }
    curPage.drawText('Documento electrónico autorizado por el Servicio de Rentas Internas del Ecuador', {
      x: MARGIN, y: y - 9, size: 7, font, color: GRAY,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
