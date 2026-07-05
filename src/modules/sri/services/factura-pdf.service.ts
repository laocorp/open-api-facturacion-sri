import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SriRepositoryService } from './sri-repository.service';
import { EmisoresService } from '../../emisores/emisores.service';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { STORAGE_PATHS } from '../../../common/utils/storage-paths';
import * as path from 'path';

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

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([612, 792]);
    let currentPage = page;
    const { width, height } = currentPage.getSize();
    let y = height - 40;

    const p = () => currentPage;
    const drawText = (text: string, x: number, size = 10, opts = {}) => {
      p().drawText(text, { x, y, size, font, ...opts });
    };
    const drawBold = (text: string, x: number, size = 10, opts = {}) => {
      p().drawText(text, { x, y, size, font: bold, ...opts });
    };
    const line = () => {
      y -= 4;
      p().drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
      y -= 8;
    };
    const box = (title: string, lines: string[]) => {
      y -= 6;
      p().drawRectangle({ x: 40, y: y - 4, width: width - 80, height: lines.length * 14 + 16, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
      drawBold(title, 48, 9);
      y -= 4;
      for (const l of lines) { y -= 14; drawText(l, 48); }
      y -= 12;
    };

    drawBold('FACTURA ELECTRÓNICA', 40, 16);
    y -= 20;
    drawText(`RUC: ${comprobante.clave_acceso?.substring(10, 23) || emisor?.ruc || ''}`, 40, 10);
    line();
    drawText(`Clave de Acceso: ${claveAcceso}`, 40);
    drawText(`Número: ${comprobante.clave_acceso?.substring(24, 27) || ''}-${comprobante.clave_acceso?.substring(27, 30) || ''}-${comprobante.secuencial || ''}`, 40);
    drawText(`Fecha: ${comprobante.fecha_emision || ''}`, 40);
    line();

    box('EMISOR', [
      emisor?.razonSocial || '',
      `RUC: ${emisor?.ruc || ''}`,
      `Dirección: ${emisor?.direccionMatriz || ''}`,
      emisor?.obligadoContabilidad ? 'Obligado a llevar contabilidad' : 'No obligado a llevar contabilidad',
    ]);

    box('COMPRADOR', [
      comprobante.receptor_razon_social || '',
      `Identificación: ${comprobante.receptor_identificacion || ''}`,
      `Dirección: ${comprobante.receptor_direccion || ''}`,
    ]);

    const colW = [40, 50, 170, 40, 60, 50, 60];
    const colX = [40, 85, 140, 315, 360, 425, 480];
    const headers = ['#', 'Código', 'Descripción', 'Cant.', 'P.Unit.', 'Desc.', 'Subtotal'];

    y -= 8;
    p().drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 18, color: rgb(0.85, 0.85, 0.85) });
    for (let i = 0; i < headers.length; i++) {
      drawBold(headers[i], colX[i], 8);
    }
    y -= 20;

    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      const pUnit = Number(d.precio_unitario) || 0;
      const desc = Number(d.descuento) || 0;
      const sub = Number(d.subtotal) || 0;
      const cant = Number(d.cantidad) || 0;
      if (y < 60) { currentPage = pdfDoc.addPage([612, 792]); y = height - 40; }
      drawText(`${i + 1}`, colX[0], 8);
      drawText(d.codigo_principal || '', colX[1], 8);
      drawText(d.descripcion || '', colX[2], 8);
      drawText(`${cant}`, colX[3], 8);
      drawText(`${pUnit.toFixed(2)}`, colX[4], 8);
      drawText(`${desc.toFixed(2)}`, colX[5], 8);
      drawText(`${sub.toFixed(2)}`, colX[6], 8);
      y -= 14;
    }

    line();
    const totalY = y;
    y = totalY;
    p().drawRectangle({ x: width - 200, y: y - 4, width: 160, height: 80, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1 });
    y -= 2;

    const toNum = (v: any) => Number(v) || 0;
    const totals = [
      { label: 'Subtotal', value: toNum(comprobante.total_sin_impuestos) },
      { label: 'Descuento', value: toNum(comprobante.total_descuento) },
      { label: 'Propina', value: toNum(comprobante.propina) },
    ];
    for (const t of totals) {
      y -= 14;
      drawText(t.label, width - 190, 9);
      drawText(`${t.value.toFixed(2)}`, width - 60, 9);
    }
    y -= 18;
    drawBold('TOTAL', width - 190, 12);
    drawBold(`${toNum(comprobante.importe_total).toFixed(2)}`, width - 60, 12);

    y = totalY - 90;
    if (pagos.length > 0) {
      y -= 8;
      drawBold('Formas de Pago:', 40, 10);
      y -= 4;
      for (const p of pagos) {
        y -= 14;
        drawText(`${p.forma_pago}: $${toNum(p.total).toFixed(2)}`, 44, 9);
      }
    }

    const authNum = comprobante.numero_autorizacion;
    const authDate = comprobante.fecha_autorizacion;
    if (authNum) {
      y = 50;
      drawText(`Autorización SRI: ${authNum}`, 40, 8, { color: rgb(0.3, 0.3, 0.3) });
      if (authDate) {
        drawText(`Fecha Autorización: ${authDate}`, 40, 8, { color: rgb(0.3, 0.3, 0.3) });
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
