import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transcripcion, operador, fecha } = await request.json();

    if (!transcripcion) {
      return NextResponse.json(
        { error: 'La transcripción es requerida' },
        { status: 400 }
      );
    }

    // Prompt para generar el informe ejecutivo
    const prompt = `
Genera un informe ejecutivo BREVE (máximo 100 palabras) para gerencia basado en esta transcripción de operador de biogás:

TRANSCRIPCIÓN: ${transcripcion}
OPERADOR: ${operador}
FECHA: ${new Date(fecha).toLocaleDateString('es-CO')}

INSTRUCCIONES:
- Máximo 100 palabras
- Solo puntos críticos para gerencia
- Estado general del sistema
- Problemas urgentes (si los hay)
- Producción/operación normal
- Formato: párrafo ejecutivo directo

Responde solo con el informe, sin introducciones.
`;

    // Verificar que la clave de OpenAI esté configurada
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Llamada a OpenAI para generar el informe
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que genera informes ejecutivos ultra-breves para biogás. Responde solo con el informe, máximo 100 palabras.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('Error en la API de OpenAI');
    }

    const data = await response.json();
    const informe = data.choices[0]?.message?.content || 'No se pudo generar el informe ejecutivo.';

    return NextResponse.json({ informe });

  } catch (error) {
    console.error('Error generando informe:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}