import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import bcrypt from 'bcryptjs';

const base = new Airtable({ apiKey: process.env.BIOGAS_BASE_API }).base('app7svOXwQT1wqUv5');

export async function POST(request: NextRequest) {
  try {
    const { action, cedula, password } = await request.json();

    if (action === 'check_cedula') {
      // Check if cedula exists
      const records = await base('Equipo_BioGas')
        .select({
          filterByFormula: `{Cedula} = '${cedula}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return NextResponse.json({ exists: false }, { status: 200 });
      }

      const record = records[0];
      const hasPassword = record.fields.Hash ? true : false;

      return NextResponse.json({
        exists: true,
        hasPassword,
        user: {
          id: record.id,
          nombre: record.fields.Nombre,
          cargo: record.fields.Cargo
        }
      }, { status: 200 });

    } else if (action === 'set_password') {
      // Set new password
      const records = await base('Equipo_BioGas')
        .select({
          filterByFormula: `{Cedula} = '${cedula}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      const record = records[0];
      if (record.fields.Hash) {
        return NextResponse.json({ error: 'El usuario ya tiene contraseña' }, { status: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      await base('Equipo_BioGas').update(record.id, {
        Hash: hash,
        Salt: salt
      });

      return NextResponse.json({ success: true }, { status: 200 });

    } else if (action === 'login') {
      // Login with password
      const records = await base('Equipo_BioGas')
        .select({
          filterByFormula: `{Cedula} = '${cedula}'`,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
      }

      const record = records[0];
      if (!record.fields.Hash) {
        return NextResponse.json({ error: 'Contraseña no configurada' }, { status: 401 });
      }

      const isValid = await bcrypt.compare(password, record.fields.Hash as string);
      if (!isValid) {
        return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        user: {
          id: record.id,
          nombre: record.fields.Nombre,
          cargo: record.fields.Cargo,
          cedula: record.fields.Cedula
        }
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    console.error('Error en login API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
