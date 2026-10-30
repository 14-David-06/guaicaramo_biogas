import { NextRequest, NextResponse } from 'next/server';
import { construirInformesDelRango } from '@/lib/informe/agregador';
import { enviarInforme, vistaPreviaCorreo } from '@/lib/informe/correo';
import { respuestaDeError } from '@/lib/informe/errores';
import { generarExcelConsolidado, nombreArchivoConsolidado } from '@/lib/informe/excel';
import { ayerBogota, diaSemana, esFechaValida, formatearFechaCorta, hoyBogota, sumarDias } from '@/lib/informe/fechas';
import { generarPdfInforme, nombreArchivoInforme } from '@/lib/informe/pdf';
import type { InformeDiario } from '@/lib/informe/tipos';

// GET /api/cron/informe-diario
//
// Envío automático de las 06:00 (hora Colombia) — programado en vercel.json a
// las 11:00 UTC. Adjunta el PDF del día anterior y el consolidado en Excel.
// Los lunes el Excel cubre la semana anterior completa (lunes a domingo), que
// es el informe semanal pedido en la reunión.
//
// Protegido con CRON_SECRET: Vercel Cron envía "Authorization: Bearer <secreto>".
// Con ?fecha=YYYY-MM-DD se puede reenviar manualmente el informe de otro día,
// y con ?vista=1 se descarga el correo como .eml sin enviarlo.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COLOR_SEVERIDAD = { critica: '#b91c1c', advertencia: '#b45309', informativa: '#6b7280' };

function valor(v: number | null, unidad = ''): string {
  return v === null ? 'Sin dato' : `${v.toLocaleString('es-CO')}${unidad ? ' ' + unidad : ''}`;
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Cuerpo del correo: lo urgente primero, igual que el PDF. */
function cuerpoCorreo(informe: InformeDiario, semanal: { desde: string; hasta: string } | null): string {
  const p = informe.produccion;
  const novedades = informe.excepciones.length
    ? `<ul>${informe.excepciones.slice(0, 10).map((e) =>
        `<li><strong style="color:${COLOR_SEVERIDAD[e.severidad]}">${escapar(e.titulo)}</strong>` +
        `${e.hora ? ` (${e.hora})` : ''}<br><span style="color:#4b5563">${escapar(e.detalle)}</span></li>`
      ).join('')}</ul>` +
      (informe.excepciones.length > 10 ? `<p>… y ${informe.excepciones.length - 10} más en el PDF adjunto.</p>` : '')
    : '<p style="color:#166534">Sin novedades. Todos los parámetros dentro de rango y registros completos.</p>';

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;max-width:640px">
      <h2 style="color:#166534;margin-bottom:4px">Informe diario de biogás</h2>
      <p style="margin-top:0;text-transform:capitalize">${escapar(informe.fechaLarga)}</p>
      <h3>Novedades y excepciones (${informe.excepciones.length})</h3>
      ${novedades}
      <h3>Producción</h3>
      <table cellpadding="4" style="border-collapse:collapse">
        <tr><td>Energía generada</td><td><strong>${valor(p.energiaGenerada, p.unidadEnergia)}</strong></td></tr>
        <tr><td>Biogás consumido</td><td><strong>${valor(p.m3Biogas, 'm³')}</strong></td></tr>
        <tr><td>Horas de operación</td><td><strong>${valor(p.horasOperacion, 'h')}</strong></td></tr>
        <tr><td>Potencia promedio</td><td><strong>${valor(p.potenciaPromedio, 'kW')}</strong></td></tr>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">
        Adjuntos: informe en PDF y consolidado en Excel
        ${semanal ? `de la semana ${formatearFechaCorta(semanal.desde)} – ${formatearFechaCorta(semanal.hasta)}` : 'del día'}.
        Generado automáticamente por la aplicación de Biogás.
      </p>
    </div>`;
}

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error('[cron-informe] CRON_SECRET no está definido; el envío automático está deshabilitado.');
    return NextResponse.json({ error: 'Envío automático no configurado.' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const fecha = request.nextUrl.searchParams.get('fecha') ?? ayerBogota();
  if (!esFechaValida(fecha) || fecha >= hoyBogota()) {
    return NextResponse.json({ error: 'Fecha inválida: debe ser un día ya terminado.' }, { status: 400 });
  }

  // El informe del domingo sale el lunes: ese día el Excel cubre lunes a domingo.
  const esSemanal = diaSemana(fecha) === 0;
  const desde = esSemanal ? sumarDias(fecha, -6) : fecha;

  try {
    const { informes, datos } = await construirInformesDelRango(desde, fecha, 'Envío automático 06:00');
    const informe = informes[informes.length - 1];
    const semanal = esSemanal ? { desde, hasta: fecha } : null;

    const correo = {
      asunto:
        `Informe biogás ${formatearFechaCorta(fecha)}` +
        (informe.excepciones.length ? ` — ${informe.excepciones.length} novedad(es)` : ' — sin novedades') +
        (semanal ? ' + consolidado semanal' : ''),
      html: cuerpoCorreo(informe, semanal),
      adjuntos: [
        { filename: nombreArchivoInforme(fecha), content: generarPdfInforme(informe), contentType: 'application/pdf' },
        {
          filename: nombreArchivoConsolidado(desde, fecha),
          content: generarExcelConsolidado({ informes, datos }),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    };

    // ?vista=1 devuelve el mensaje como .eml (se abre en Outlook) sin enviarlo.
    if (request.nextUrl.searchParams.get('vista') === '1') {
      const eml = await vistaPreviaCorreo(correo);
      return new NextResponse(new Uint8Array(eml), {
        headers: {
          'Content-Type': 'message/rfc822',
          'Content-Disposition': `attachment; filename="informe-biogas-${fecha}.eml"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    const resultado = await enviarInforme(correo);

    // Registro de auditoría (RF-02.6): queda en los logs de la función.
    console.log('[cron-informe] Enviado', JSON.stringify({ fecha, desde, ...resultado }));
    return NextResponse.json({ enviado: true, fecha, desde, ...resultado });
  } catch (error) {
    console.error('[cron-informe] Falló el envío del informe de', fecha);
    return respuestaDeError('cron-informe', error);
  }
}
