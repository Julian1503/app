/** Extraccion: de la nota de Deputy a los campos del formulario.
 *
 *  El modelo no redacta nada aca. Lee la nota y dice, campo por campo, que esta
 *  documentado y con que evidencia, y que falta. Lo que falta sale como pregunta,
 *  no como relleno. */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { formatMinute } from '../../shared/dates.js';
import type { FieldAnswer, Gap } from '../../shared/form/answers.js';
import { FORM_FIELDS, findField, slotForShift } from '../../shared/form/schema.js';
import { findBehaviour } from '../../shared/reports/behaviours.js';
import { findTag } from '../../shared/reports/tags.js';
import type { ShiftReport } from '../../shared/reports/types.js';
import type { Shift } from '../../shared/types.js';
import { config } from '../config.js';
import { getClient } from './../reports/claude.js';

const NEWLINE = String.fromCharCode(10);
const MAX_GAPS = 8;

const FIELD_IDS = FORM_FIELDS.map((field) => field.id);

function asTuple(values: readonly string[]): [string, ...string[]] {
  return values as unknown as [string, ...string[]];
}

const ExtractionSchema = z.object({
  answers: z.array(
    z.object({
      fieldId: z.enum(asTuple(FIELD_IDS)),
      values: z.array(z.string()),
      /** Cita textual de la nota que sostiene la respuesta. */
      evidence: z.string(),
    }),
  ),
  gaps: z.array(
    z.object({
      fieldId: z.enum(asTuple(FIELD_IDS)),
      question: z.string(),
      options: z.array(z.string()),
      multi: z.boolean(),
    }),
  ),
});

/** El esquema, escrito para el prompt. Las opciones se listan textuales: el
 *  modelo tiene que elegir de ahi, no proponer las suyas. */
function schemaForPrompt(): string {
  return FORM_FIELDS.map((field) => {
    const options =
      field.options.length > 0 ? ` Options (use these exact strings): ${field.options.join(' | ')}` : '';
    const rule = field.showIf;
    const conditional = rule
      ? rule.anyOf
        ? ` Only applies when ${rule.fields.join(' or ')} is one of: ${rule.anyOf.join(' | ')}.`
        : ` Only applies when ${rule.fields.join(' or ')} has a selection other than: ${(rule.anyExcept ?? []).join(' | ')}.`
      : '';
    const kind = field.kind === 'multi' ? 'select any that apply' : field.kind;
    return `${field.id} (Q${field.number}) ${field.label} [${kind}]${options}${conditional}`;
  }).join(NEWLINE);
}

export const EXTRACT_SYSTEM = [
  'You map a support worker\'s shift notes onto a Behaviour Recording and',
  'Monitoring Form. You do not write a report. You fill in form fields, and you',
  'flag the fields you cannot fill.',
  '',
  'THE FORM',
  '',
  schemaForPrompt(),
  '',
  'HOW TO FILL A FIELD',
  '',
  'Return an answer for a field only when the source actually states it, and give',
  'the exact words from the source as evidence. For fields with options, values',
  'must be copied character for character from that field\'s option list.',
  '',
  'Extract what IS stated, including what it implies literally. If the notes say',
  '"I prompted him to lower his voice, which he did briefly before becoming noisy',
  'again", that documents a partial redirection (q15 = Partially). Do not make the',
  'worker re-enter what they already wrote.',
  '',
  'Counts matter: q6, q7 and q8 are ranges, not yes/no. Only choose a range when',
  'the notes support it. One prompt described in the notes is not evidence that the',
  'total for the shift falls in any particular band - raise a gap instead.',
  '',
  '"None noted" is the correct selection for q11, q17 and q18 when the notes',
  'describe no such behaviour. It is a real answer, not a fallback.',
  '',
  'WHAT YOU MUST NEVER DO',
  '',
  'Never invent a frequency, duration, intensity, time, location, intervention,',
  'outcome, sleep information, appetite information, or a "settled" status. Never',
  'assume verbal redirection, reassurance, emotional regulation support,',
  'monitoring, checking on the client, or that a behaviour stopped because of an',
  'intervention. Never assume a behaviour happened more than once. Never change',
  'the shift times.',
  '',
  'Never upgrade a related activity into a behaviour category. These are not the',
  'same thing:',
  '',
  '  "searched for prayers on the TV"  is NOT automatically "Excessive praying"',
  '  "talked about the same topic"     is NOT automatically a behaviour of concern',
  '  "was quiet"                       is NOT automatically "Avoidance"',
  '',
  'When the source describes an activity that MIGHT correspond to a behaviour',
  'option, do not select the option. Raise a gap asking the worker to confirm the',
  'classification, and quote the activity in the question.',
  '',
  'A field being required does not permit you to fill it. Required and unknown',
  'means: raise a gap.',
  '',
  'RAISING GAPS',
  '',
  'A gap is a question for the worker about a field you could not fill. Rules:',
  '',
  '- Never raise a gap for something the notes already state.',
  '- Never raise a gap for a conditional field whose trigger is not met.',
  `- At most ${MAX_GAPS} gaps, and fewer is better. If the form is covered, return`,
  '  an empty list.',
  '- Where the field has options, the gap options must be exactly that list.',
  '- Where the field is free text, offer short quick-pick options if there is a',
  '  sensible small set (for example timing: "Start of shift" | "Middle of shift"',
  '  | "End of shift"), otherwise return an empty options list for a short text',
  '  answer.',
  '- Never phrase a question as an assertion. Ask whether something happened; do',
  '  not state that it did.',
  '- Do not ask the worker to describe or rewrite the shift.',
  '',
  'The interface adds "Not recorded", "Not known" and "Unable to recall" to every',
  'gap, so do not include those yourself.',
].join(NEWLINE);

/** Lo que ya se sabe sin preguntarle a nadie, mas lo que el trabajador tildo. */
function sourceBlock(shift: Shift, report: ShiftReport): string {
  const ticked = report.observations
    .map((observation) => {
      const behaviour = findBehaviour(observation.behaviourId);
      if (!behaviour) return null;
      const measure =
        observation.value === null
          ? ''
          : ` (${observation.value} ${behaviour.unit === 'minutes' ? 'minutes' : 'times'})`;
      const note = observation.note.trim();
      return `- ${behaviour.label}${measure}${note ? ` - ${note}` : ''}`;
    })
    .filter((line): line is string => line !== null);

  const tags = report.presentationTags
    .map((id) => findTag(id)?.label)
    .filter((label): label is string => label !== undefined);

  return [
    'SHIFT RECORD (authoritative, do not change):',
    `Date: ${shift.date}`,
    `Time period: ${formatMinute(shift.startMinute)}-${formatMinute(shift.endMinute)}`,
    shift.area ? `Deputy location: ${shift.area}` : null,
    '',
    'THE WORKER HAS ALREADY TICKED ON THIS TOOL:',
    ticked.length > 0 ? ticked.join(NEWLINE) : '- (no behaviours ticked)',
    tags.length > 0 ? `Presentation: ${tags.join(', ')}` : null,
    report.support.trim() ? `Support entered: ${report.support.trim()}` : null,
    report.presentation.trim() ? `Other notes entered: ${report.presentation.trim()}` : null,
    '',
    'THE WORKER\'S DEPUTY SHIFT NOTES:',
    shift.employeeComment?.trim() || '(no notes were left for this shift)',
    '',
    'Map this onto the form and list the gaps.',
  ]
    .filter((line): line is string => line !== null)
    .join(NEWLINE);
}

/** Q1-Q3 salen del registro del turno, no del modelo: son datos que ya tenemos
 *  exactos y hacerlos pasar por una inferencia solo agrega formas de equivocarse. */
/** El formulario espera M/dd/YYYY: el mes sin cero adelante, el dia con el. */
function formFormatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(month)}/${day}/${year}`;
}

function fromShiftRecord(shift: Shift): FieldAnswer[] {
  const answers: FieldAnswer[] = [
    {
      fieldId: 'q2',
      values: [formFormatDate(shift.date)],
      status: 'documented',
      evidence: 'Deputy shift record',
    },
  ];

  // Q1 es quien completa el formulario, no Josh. Sin nombre configurado se
  // pregunta, en vez de poner el del cliente.
  if (config.reportsWorkerName) {
    answers.push({
      fieldId: 'q1',
      values: [config.reportsWorkerName],
      status: 'documented',
      evidence: 'REPORTS_WORKER_NAME',
    });
  }

  // Q3 es el periodo en que trabajaste con Josh, y el formulario aclara que no
  // es el horario del turno. Solo se propone cuando el turno entra entero en una
  // franja; si la cruza, es un hueco a preguntar.
  const slot = slotForShift(shift.startMinute, shift.endMinute);
  if (slot) {
    answers.push({
      fieldId: 'q3',
      values: [slot],
      status: 'documented',
      evidence: `Deputy shift record: ${formatMinute(shift.startMinute)}-${formatMinute(shift.endMinute)}`,
    });
  }

  return answers;
}

/** Descarta lo que el modelo se haya inventado fuera de las opciones del campo.
 *  El prompt lo pide; esta funcion lo garantiza. */
function keepValidValues(fieldId: string, values: readonly string[]): string[] {
  const field = findField(fieldId);
  if (!field) return [];
  if (field.options.length === 0) return values.map((value) => value.trim()).filter(Boolean);
  const allowed = new Set(field.options);
  const kept = values.filter((value) => allowed.has(value));
  return field.kind === 'multi' ? kept : kept.slice(0, 1);
}

export interface Extraction {
  readonly answers: readonly FieldAnswer[];
  readonly gaps: readonly Gap[];
}

export async function extractForm(shift: Shift, report: ShiftReport): Promise<Extraction> {
  const response = await getClient().messages.parse({
    model: config.anthropicModel,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: sourceBlock(shift, report) }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude no pudo mapear este turno.');
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('No se pudo leer el mapeo: la respuesta vino incompleta.');

  const record = fromShiftRecord(shift);
  const fixed = new Set(record.map((answer) => answer.fieldId));

  const answers: FieldAnswer[] = [...record];
  for (const answer of parsed.answers) {
    // El registro del turno gana: el modelo no reescribe fecha ni horario.
    if (fixed.has(answer.fieldId)) continue;
    const values = keepValidValues(answer.fieldId, answer.values);
    if (values.length === 0) continue;
    answers.push({
      fieldId: answer.fieldId,
      values,
      status: 'documented',
      evidence: answer.evidence.trim(),
    });
  }

  const answered = new Set(answers.map((answer) => answer.fieldId));
  const gaps = parsed.gaps
    .filter((gap) => !answered.has(gap.fieldId))
    .slice(0, MAX_GAPS)
    .map((gap) => {
      const field = findField(gap.fieldId);
      return {
        fieldId: gap.fieldId,
        question: gap.question.trim(),
        // Si el campo tiene opciones, son esas y no las que proponga el modelo.
        options: field && field.options.length > 0 ? field.options : gap.options.slice(0, 6),
        multi: field?.kind === 'multi' ? true : gap.multi,
      };
    });

  return { answers, gaps };
}
