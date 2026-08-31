/** Redaccion final, campo por campo.
 *
 *  Solo toca los campos de texto libre: los de opciones ya tienen su valor
 *  elegido de la lista del formulario y no hay nada que redactar ahi.
 *
 *  La materia prima es lo documentado y lo que confirmaste. Nada mas entra. */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { type FieldAnswer, usableAnswers } from '../../shared/form/answers.js';
import { FORM_FIELDS, findField } from '../../shared/form/schema.js';
import { config } from '../config.js';
import { getClient } from '../reports/claude.js';

const NEWLINE = String.fromCharCode(10);

/** Nombre, fecha y franja horaria salen del registro del turno y de tu config.
 *  Ya estan exactos: pasarlos por la redaccion solo agrega formas de que cambien
 *  (la fecha volvia reformateada). */
const FIXED_FIELDS: readonly string[] = ['q1', 'q2', 'q3'];

const FREE_TEXT: readonly string[] = FORM_FIELDS.filter(
  (field) =>
    (field.kind === 'text' || field.kind === 'longtext') && !FIXED_FIELDS.includes(field.id),
).map((field) => field.id);

function asTuple(values: readonly string[]): [string, ...string[]] {
  return values as unknown as [string, ...string[]];
}

const FinaliseSchema = z.object({
  answers: z.array(
    z.object({
      fieldId: z.enum(asTuple(FREE_TEXT)),
      text: z.string(),
    }),
  ),
});

export const FINALISE_SYSTEM = [
  'You write the free-text answers of a Behaviour Recording and Monitoring Form',
  'for an Australian disability support service. You are given, per field, the raw',
  'material the worker documented or explicitly confirmed.',
  '',
  'Your only job is to turn each field\'s raw material into the answer that belongs',
  'in that box. One field at a time. This is form completion, not a narrative: do',
  'not write an overall story of the shift, and do not repeat one field\'s content',
  'inside another.',
  '',
  'Absolute rules:',
  '',
  '1. Use ONLY the material given for that field. Never add an event, behaviour,',
  '   activity, conversation, meal, medication, emotion, symptom, intervention or',
  '   outcome that is not in it. If the material is thin, the answer is short.',
  '',
  '2. Never invent a frequency, duration, intensity, time, location, or outcome.',
  '   Use the worker\'s figures exactly: 2 stays "twice", never "several" or',
  '   "repeatedly".',
  '',
  '3. Never write meta-commentary about the notes. Phrases like "no further',
  '   details were recorded", "the worker did not record", "no frequency was',
  '   recorded" or "it is unknown whether" must never appear. The absence of a',
  '   detail never becomes a statement about that absence - just leave it out.',
  '',
  '4. Never write generic filler that the material does not support: "presented as',
  '   settled", "slept well", "ate well", "engaged appropriately", "remained',
  '   regulated", "no further concerns".',
  '',
  'Style: Australian disability support register, factual and observational, past',
  'tense, third person, refer to the client by name. Plain sentences. No headings,',
  'no bullets, no filler. Most answers are one or two sentences.',
  '',
  'Return one entry per field you were given material for. Do not invent entries',
  'for fields that were not given to you.',
].join(NEWLINE);

function materialFor(answers: readonly FieldAnswer[], clientName: string): string | null {
  const usable = usableAnswers(answers);
  const blocks = usable
    .filter((answer) => FREE_TEXT.includes(answer.fieldId))
    .map((answer) => {
      const field = findField(answer.fieldId);
      if (!field) return null;
      const source = answer.status === 'confirmed' ? 'confirmed by the worker' : 'from the notes';
      return [
        `${field.id} (Q${field.number}) - ${field.label}`,
        `Material (${source}): ${answer.values.join('; ')}`,
        answer.evidence.trim() ? `Source wording: ${answer.evidence.trim()}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join(NEWLINE);
    })
    .filter((block): block is string => block !== null);

  if (blocks.length === 0) return null;

  // Los campos de opciones van como contexto, no para redactar: ayudan a que el
  // texto no contradiga lo ya elegido en el formulario.
  const chosen = usable
    .filter((answer) => !FREE_TEXT.includes(answer.fieldId))
    .map((answer) => {
      const field = findField(answer.fieldId);
      return field ? `Q${field.number} ${field.label}: ${answer.values.join(', ')}` : null;
    })
    .filter((line): line is string => line !== null);

  return [
    `Client: ${clientName}`,
    '',
    'Already selected on the form (context only - do not rewrite these):',
    chosen.length > 0 ? chosen.join(NEWLINE) : '(none)',
    '',
    'Write the answer for each of these fields:',
    '',
    blocks.join(NEWLINE + NEWLINE),
  ].join(NEWLINE);
}

/** Devuelve las respuestas con los campos de texto libre ya redactados.
 *  Los campos de opciones vuelven intactos. */
export async function finaliseForm(answers: readonly FieldAnswer[]): Promise<FieldAnswer[]> {
  const material = materialFor(answers, config.reportsClientName);
  if (!material) return [...answers];

  const response = await getClient().messages.parse({
    model: config.anthropicModel,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: FINALISE_SYSTEM,
    messages: [{ role: 'user', content: material }],
    output_config: { format: zodOutputFormat(FinaliseSchema) },
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude no redacto las respuestas.');
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('No se pudieron leer las respuestas: la respuesta vino incompleta.');

  const written = new Map(
    parsed.answers
      .filter((answer) => answer.text.trim().length > 0)
      .map((answer) => [answer.fieldId, answer.text.trim()]),
  );

  // Solo se reemplaza el texto de un campo que ya tenia material: si el modelo
  // devuelve un campo que no le dimos, se ignora.
  return answers.map((answer) => {
    const text = written.get(answer.fieldId);
    return text ? { ...answer, values: [text] } : answer;
  });
}
