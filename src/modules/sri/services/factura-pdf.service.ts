import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SriRepositoryService } from './sri-repository.service';
import { EmisoresService } from '../../emisores/emisores.service';

const BLACK = rgb(0.07, 0.07, 0.07);
const DARK = rgb(0.15, 0.15, 0.15);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.55, 0.55, 0.55);
const FAINT = rgb(0.85, 0.85, 0.85);
const WHITE = rgb(1, 1, 1);
const ACCENT = rgb(0.06, 0.18, 0.34);

const MARGIN = 40;
const PAGE_W = 612;
const PAGE_H = 792;
const CW = PAGE_W - MARGIN * 2;

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

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const nf = (v: any) => { const n = Number(v); return isNaN(n) ? '0.00' : n.toFixed(2); };
    const check = (n: number) => {
      if (y - n < 60) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
    };

    const rawFecha = comprobante.fecha_emision as any;
    const fechaEmision = rawFecha instanceof Date
      ? rawFecha.toISOString().split('T')[0]
      : String(comprobante.fecha_emision || '');
    const rawRuc = emisor?.ruc || comprobante.clave_acceso?.substring(10, 23) || '';
    const numDoc = `${comprobante.clave_acceso?.substring(24, 27) || ''}-${comprobante.clave_acceso?.substring(27, 30) || ''}-${comprobante.secuencial || ''}`;

    // ── TOP: title + meta row ──
    page.drawText('FACTURA ELECTRÓNICA', { x: MARGIN, y, size: 22, font: bold, color: BLACK });
    y -= 26;
    page.drawText(numDoc, { x: MARGIN, y, size: 10, font, color: GRAY });
    page.drawText(fechaEmision, { x: MARGIN + 120, y, size: 10, font, color: GRAY });
    page.drawText(`RUC ${rawRuc}`, { x: MARGIN + 230, y, size: 10, font, color: GRAY });
    y -= 18;

    // Ambiente badge
    const amb = comprobante.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS';
    page.drawText(amb, { x: MARGIN + CW - font.widthOfTextAtSize(amb, 8), y, size: 8, font: bold, color: GRAY });

    // ── Clave de acceso ──
    y -= 6;
    page.drawText('CLAVE DE ACCESO', { x: MARGIN, y, size: 7, font: bold, color: LIGHT });
    y -= 11;
    page.drawText(claveAcceso, { x: MARGIN, y, size: 10, font: mono, color: DARK });
    y -= 18;

    // Thin line
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CW, y }, thickness: 0.5, color: FAINT });
    y -= 24;

    // ── SIDE-BY-SIDE: Emisor / Comprador ──
    check(80);
    const hw = (CW - 16) / 2;
    const boxTop = y;
    const drawSide = (lines: { t: string; v: string }[], x: number) => {
      let sy = y;
      for (const l of lines) {
        if (!l.v && !l.t) { sy -= 4; continue; }
        page.drawText(l.t, { x, y: sy, size: 8, font, color: GRAY });
        const lw = font.widthOfTextAtSize(l.t, 8);
        page.drawText(l.v, { x: x + lw, y: sy, size: 8, font, color: DARK });
        sy -= 12;
      }
      return sy;
    };

    const eLines = [
      { t: '', v: emisor?.razonSocial || '' },
      { t: 'RUC ', v: rawRuc },
      { t: '', v: emisor?.direccionMatriz || '' },
    ];
    if (emisor?.obligadoContabilidad) {
      eLines.push({ t: '', v: 'Obligado a llevar contabilidad' });
    }
    page.drawText('EMISOR', { x: MARGIN, y: boxTop, size: 9, font: bold, color: BLACK });
    const eBot = drawSide(eLines, MARGIN);

    const tipoId = TIPO_ID_MAP[comprobante.receptor_tipo_identificacion || ''] || comprobante.receptor_tipo_identificacion || '';
    const cLines = [
      { t: '', v: comprobante.receptor_razon_social || '' },
      { t: `${tipoId} `, v: comprobante.receptor_identificacion || '' },
      { t: '', v: comprobante.receptor_direccion || '' },
    ];
    if (comprobante.receptor_telefono) cLines.push({ t: 'Tel. ', v: comprobante.receptor_telefono });

    page.drawText('COMPRADOR', { x: MARGIN + hw + 16, y: boxTop, size: 9, font: bold, color: BLACK });
    const cBot = drawSide(cLines, MARGIN + hw + 16);

    y = Math.min(eBot, cBot) - 8;

    // Thin line
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CW, y }, thickness: 0.5, color: FAINT });
    y -= 20;

    // ── ITEMS TABLE ──
    check(22);
    const cols = [
      { x: MARGIN, w: 20, h: '#' },
      { x: MARGIN + 22, w: 58, h: 'Código' },
      { x: MARGIN + 82, w: 228, h: 'Descripción' },
      { x: MARGIN + 312, w: 42, h: 'Cant.', r: true },
      { x: MARGIN + 356, w: 60, h: 'P.Unit.', r: true },
      { x: MARGIN + 418, w: 48, h: 'Desc.', r: true },
      { x: MARGIN + 468, w: 104, h: 'Subtotal', r: true },
    ];
    const ftw = cols[cols.length - 1].x + cols[cols.length - 1].w - MARGIN;

    const drawTh = () => {
      for (const c of cols) {
        page.drawText(c.h, {
          x: c.r ? c.x + c.w - bold.widthOfTextAtSize(c.h, 7) : c.x,
          y, size: 7, font: bold, color: LIGHT,
        });
      }
    };
    drawTh();
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + ftw, y }, thickness: 0.5, color: FAINT });
    y -= 10;

    const rh = 16;
    const descMax = 80;

    for (let i = 0; i < detalles.length; i++) {
      if (y < 80) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        drawTh(); y -= 8;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + ftw, y }, thickness: 0.5, color: FAINT });
        y -= 10;
      }

      const d = detalles[i];
      const desc = d.descripcion || '';
      const descLine = desc.length > descMax ? desc.substring(0, descMax) + '...' : desc;

      const vals = [
        `${i + 1}`, d.codigo_principal || '', descLine,
        `${Number(d.cantidad) || 0}`, nf(d.precio_unitario), nf(d.descuento), nf(d.subtotal),
      ];
      for (let ci = 0; ci < cols.length; ci++) {
        const c = cols[ci];
        page.drawText(vals[ci], {
          x: c.r ? c.x + c.w - font.widthOfTextAtSize(vals[ci], 8) : c.x,
          y, size: 8, font, color: DARK,
        });
      }
      y -= rh;
    }

    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + ftw, y }, thickness: 0.5, color: FAINT });
    y -= 20;

    // ── TOTALS (right-aligned block) ──
    check(80);
    const lx = MARGIN + ftw - 200;

    const totL = (label: string, val: any, sz = 9, fb = font, fc = DARK) => {
      const v = `$ ${nf(val)}`;
      page.drawText(label, { x: lx, y, size: sz, font: fb, color: GRAY });
      page.drawText(v, { x: lx + 200 - font.widthOfTextAtSize(v, sz), y, size: sz, font: fb, color: fc });
      y -= sz + 4;
    };

    totL('Subtotal', comprobante.total_sin_impuestos);

    for (const t of totales) {
      const pct = t.tarifa ? ` ${Number(t.tarifa).toFixed(1)}%` : '';
      const codPct = t.codigo_porcentaje || '';
      let label = 'Impuesto';
      if (t.codigo === '2') {
        const ivaL: Record<string, string> = { '0': 'IVA 0%', '2': 'IVA 12%', '3': 'IVA 14%', '4': 'IVA 15%', '6': 'IVA 15%' };
        label = ivaL[codPct] || `IVA${pct}`;
      }
      totL(label, t.valor, 8);
    }

    if (Number(comprobante.total_descuento) > 0) totL('Descuento', comprobante.total_descuento, 8);
    if (Number(comprobante.propina) > 0) totL('Propina', comprobante.propina, 8);

    y -= 2;
    page.drawLine({ start: { x: lx, y }, end: { x: lx + 200, y }, thickness: 1, color: DARK });
    y -= 8;
    totL('Total', comprobante.importe_total, 13, bold, ACCENT);

    // ── PAYMENTS ──
    if (pagos.length > 0) {
      y -= 10;
      page.drawText('Formas de Pago', { x: MARGIN, y, size: 8, font: bold, color: DARK });
      y -= 14;
      for (const p of pagos) {
        const fpLabel = FORMA_PAGO_MAP[p.forma_pago] || p.forma_pago;
        const pv = `$ ${nf(p.total)}`;
        const pw = font.widthOfTextAtSize(pv, 8);
        page.drawText(fpLabel, { x: MARGIN, y, size: 8, font, color: GRAY });
        page.drawText(pv, { x: MARGIN + 140, y, size: 8, font, color: DARK });
        y -= 12;
      }
    }

    // ── FOOTER ──
    y = 56;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CW, y }, thickness: 0.5, color: FAINT });
    y -= 14;

    const authNum = comprobante.numero_autorizacion;
    const authDate = comprobante.fecha_autorizacion;

    if (authNum) {
      page.drawText('Autorización SRI', { x: MARGIN, y, size: 7, font: bold, color: LIGHT });
      y -= 10;
      page.drawText(authNum, { x: MARGIN, y, size: 8, font: mono, color: DARK });
      y -= 14;
    }
    if (authDate) {
      page.drawText('Fecha de autorización', { x: MARGIN, y, size: 7, font: bold, color: LIGHT });
      y -= 10;
      const d = new Date(authDate).toLocaleString('es-EC', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' });
      page.drawText(d, { x: MARGIN, y, size: 8, font, color: DARK });
      y -= 14;
    }
    page.drawText('Documento electrónico autorizado por el Servicio de Rentas Internas del Ecuador', {
      x: MARGIN, y, size: 7, font, color: LIGHT,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
