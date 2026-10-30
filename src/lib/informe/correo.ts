import 'server-only';

// Envío del informe por correo (RF-02.3, RF-02.4, RF-02.6, RF-02.7).
//
// Dos canales, según lo que esté configurado:
//
// 1. Microsoft Graph (preferido): app de Azure con permiso de aplicación
//    Mail.Send y consentimiento de administrador. Envía desde el buzón
//    OUTLOOK_SENDER_EMAIL sin depender de SMTP AUTH, que Microsoft 365 trae
//    deshabilitado por defecto. Variables: AZURE_TENANT_ID, AZURE_CLIENT_ID,
//    AZURE_CLIENT_SECRET, OUTLOOK_SENDER_EMAIL.
// 2. SMTP (respaldo): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
//
// Los destinatarios se configuran en INFORME_DESTINATARIOS (separados por coma)
// sin desplegar código.

import nodemailer from 'nodemailer';
import { ErrorConfiguracion } from './airtable-server';

export interface Adjunto {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface ResultadoEnvio {
  canal: 'graph' | 'smtp';
  remitente: string;
  destinatarios: string[];
  intentos: number;
  idMensaje: string;
}

interface Correo {
  asunto: string;
  html: string;
  adjuntos: Adjunto[];
}

const INTENTOS = 2;
const ESPERA_REINTENTO_MS = 5000;

export function destinatariosConfigurados(): string[] {
  return (process.env.INFORME_DESTINATARIOS ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------ Microsoft Graph

function configuracionGraph() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, OUTLOOK_SENDER_EMAIL } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !OUTLOOK_SENDER_EMAIL) return null;
  return { tenant: AZURE_TENANT_ID, clientId: AZURE_CLIENT_ID, secreto: AZURE_CLIENT_SECRET, remitente: OUTLOOK_SENDER_EMAIL };
}

async function tokenGraph(c: NonNullable<ReturnType<typeof configuracionGraph>>): Promise<string> {
  const respuesta = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: c.clientId,
      client_secret: c.secreto,
      scope: 'https://graph.microsoft.com/.default'
    }),
    cache: 'no-store'
  });
  const datos = (await respuesta.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!respuesta.ok || !datos.access_token) {
    // Un error de credenciales no se arregla reintentando: se reporta como configuración.
    throw new ErrorConfiguracion(
      `Azure rechazó las credenciales de la app (${datos.error ?? respuesta.status}): ` +
      `${(datos.error_description ?? '').split('\r\n')[0]}`
    );
  }
  return datos.access_token;
}

async function enviarPorGraph(c: NonNullable<ReturnType<typeof configuracionGraph>>, destinatarios: string[], correo: Correo) {
  const token = await tokenGraph(c);
  const respuesta = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.remitente)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: correo.asunto,
        body: { contentType: 'HTML', content: correo.html },
        toRecipients: destinatarios.map((address) => ({ emailAddress: { address } })),
        // Graph admite hasta 3 MB por adjunto en esta llamada; el PDF y el Excel pesan < 500 KB.
        attachments: correo.adjuntos.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.content.toString('base64')
        }))
      },
      saveToSentItems: true
    }),
    cache: 'no-store'
  });

  if (respuesta.status !== 202) {
    const cuerpo = await respuesta.text();
    const mensaje = `Graph respondió ${respuesta.status} al enviar desde ${c.remitente}: ${cuerpo.slice(0, 400)}`;
    // 401/403: falta el permiso Mail.Send o el consentimiento del administrador.
    if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorConfiguracion(mensaje);
    throw new Error(mensaje);
  }
  return respuesta.headers.get('request-id') ?? 'graph-202';
}

// ----------------------------------------------------------------------- SMTP

function crearTransporteSmtp() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const puerto = Number(SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// ---------------------------------------------------------------------- Envío

/** Envía el correo con un reintento. Lanza el último error si ambos intentos fallan. */
export async function enviarInforme(correo: Correo): Promise<ResultadoEnvio> {
  const destinatarios = destinatariosConfigurados();
  if (destinatarios.length === 0) {
    throw new ErrorConfiguracion('INFORME_DESTINATARIOS está vacío: no hay a quién enviar el informe.');
  }

  const graph = configuracionGraph();
  const smtp = graph ? null : crearTransporteSmtp();
  if (!graph && !smtp) {
    throw new ErrorConfiguracion(
      'No hay canal de correo configurado: defina AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET y ' +
      'OUTLOOK_SENDER_EMAIL (Microsoft Graph) o SMTP_HOST, SMTP_USER y SMTP_PASS.'
    );
  }
  const remitente = graph ? graph.remitente : (process.env.SMTP_FROM ?? process.env.SMTP_USER!);
  let ultimoError: unknown;

  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const idMensaje = graph
        ? await enviarPorGraph(graph, destinatarios, correo)
        : (await smtp!.sendMail({ from: remitente, to: destinatarios, subject: correo.asunto, html: correo.html, attachments: correo.adjuntos })).messageId;
      return { canal: graph ? 'graph' : 'smtp', remitente, destinatarios, intentos: intento, idMensaje };
    } catch (error) {
      ultimoError = error;
      console.error(`[correo] Intento ${intento} de ${INTENTOS} fallido:`, error);
      if (error instanceof ErrorConfiguracion) break;
      if (intento < INTENTOS) await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS));
    }
  }

  throw ultimoError;
}

/**
 * Arma el mensaje completo (.eml, con adjuntos) sin enviarlo, para revisar cómo
 * llegará. No requiere credenciales: si aún no hay destinatarios usa uno de ejemplo.
 */
export async function vistaPreviaCorreo(correo: Correo): Promise<Buffer> {
  const destinatarios = destinatariosConfigurados();
  const transporte = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const info = await transporte.sendMail({
    from: process.env.OUTLOOK_SENDER_EMAIL ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'Biogás Guaicaramo <informes@ejemplo.com>',
    to: destinatarios.length ? destinatarios : ['destinatario@ejemplo.com'],
    subject: correo.asunto,
    html: correo.html,
    attachments: correo.adjuntos
  });
  return info.message as Buffer;
}
