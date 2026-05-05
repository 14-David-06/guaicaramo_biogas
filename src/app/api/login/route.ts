import { NextRequest, NextResponse } from 'next/server';
import Airtable, { FieldSet, Record as AirtableRecord } from 'airtable';
import bcrypt from 'bcryptjs';

// Usar las nuevas variables de entorno configuradas
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN || process.env.AIRTABLE_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
const EQUIPO_BIOGAS_TABLE_ID = process.env.NEXT_PUBLIC_EQUIPO_BIOGAS_TABLE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !EQUIPO_BIOGAS_TABLE_ID) {
  throw new Error('Missing Airtable configuration. Check environment variables.');
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const USER_FIELDS = ['Cedula', 'Nombre', 'Cargo', 'Hash', 'Salt'];

// Sanitiza la cedula para uso en filterByFormula (solo digitos)
function sanitizeCedula(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

async function getUserRecord(
  recordId?: string,
  cedula?: string
): Promise<AirtableRecord<FieldSet> | null> {
  // Mas rapido: lookup directo por id
  if (recordId) {
    try {
      return await base(EQUIPO_BIOGAS_TABLE_ID!).find(recordId);
    } catch {
      return null;
    }
  }

  if (!cedula) return null;

  const records = await base(EQUIPO_BIOGAS_TABLE_ID!)
    .select({
      filterByFormula: `{Cedula} = '${cedula}'`,
      maxRecords: 1,
      fields: USER_FIELDS,
    })
    .firstPage();

  return records[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, password } = body;
    const cedula = sanitizeCedula(body.cedula);
    const recordId: string | undefined = body.recordId;

    if (action === 'check_cedula') {
      const record = await getUserRecord(undefined, cedula);

      if (!record) {
        return NextResponse.json({ exists: false }, { status: 200 });
      }

      const hasPassword = !!record.fields.Hash;

      return NextResponse.json({
        exists: true,
        hasPassword,
        user: {
          id: record.id,
          nombre: record.fields.Nombre,
          cargo: record.fields.Cargo,
          cedula: record.fields.Cedula,
        },
      }, { status: 200 });

    } else if (action === 'set_password') {
      const record = await getUserRecord(recordId, cedula);

      if (!record) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      if (record.fields.Hash) {
        return NextResponse.json({ error: 'El usuario ya tiene contraseña' }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      await base(EQUIPO_BIOGAS_TABLE_ID!).update(record.id, {
        Hash: hash,
        Salt: salt,
      });

      return NextResponse.json({ success: true }, { status: 200 });

    } else if (action === 'login') {
      const record = await getUserRecord(recordId, cedula);

      if (!record) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
      }

      const hash = record.fields.Hash as string | undefined;
      if (!hash) {
        return NextResponse.json({ error: 'Contraseña no configurada' }, { status: 401 });
      }

      const isValid = await bcrypt.compare(password, hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        user: {
          id: record.id,
          nombre: record.fields.Nombre,
          cargo: record.fields.Cargo,
          cedula: record.fields.Cedula,
        },
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    console.error('Error en login API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
