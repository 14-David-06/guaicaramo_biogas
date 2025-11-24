import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Obtener el FormData del request
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Verificar que la clave de OpenAI esté configurada
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Crear nuevo FormData para enviar a OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append('file', file);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'es'); // Español
    openaiFormData.append('response_format', 'text');

    // Hacer la petición a OpenAI desde el servidor
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', errorData);
      return NextResponse.json({ error: 'Transcription failed' }, { status: response.status });
    }

    // Obtener la transcripción
    const transcription = await response.text();

    // Devolver la transcripción como texto plano
    return new NextResponse(transcription.trim(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}