/** Respuestas del formulario y su procedencia.
 *
 *  Cada respuesta sabe de donde salio, y eso decide si puede usarse. Un valor
 *  sin procedencia no existe: el hueco se pregunta, no se completa. */

import { findField, type FormField } from './schema.ts';

export type AnswerStatus =
  /** Sale de la nota de Deputy o del registro del turno. */
  | 'documented'
  /** La confirmaste vos respondiendo una pregunta. */
  | 'confirmed'
  /** No se puede establecer, y asi queda. */
  | 'unavailable';

export interface FieldAnswer {
  readonly fieldId: string;
  /** Siempre lista: un campo de una sola opcion trae un elemento. */
  readonly values: readonly string[];
  readonly status: AnswerStatus;
  /** Cita de la nota, o de donde se tomo. Es lo que hace auditable la respuesta. */
  readonly evidence: string;
}

/** Un campo que falta y que conviene preguntar. */
export interface Gap {
  readonly fieldId: string;
  /** La pregunta al trabajador, en ingles. */
  readonly question: string;
  /** Opciones de respuesta rapida. Vacio = texto corto. */
  readonly options: readonly string[];
  readonly multi: boolean;
}

/** Salidas validas cuando el dato genuinamente no esta. No fuerzan un invento. */
export const UNAVAILABLE_OPTIONS = ['Not recorded', 'Not known', 'Unable to recall'] as const;

export function isUnavailable(value: string): boolean {
  return (UNAVAILABLE_OPTIONS as readonly string[]).includes(value);
}

/** Un campo condicional solo aplica si su disparador tiene el valor esperado.
 *
 *  Sin esto la pantalla pide Q16 ("por que no funciono") cuando Q15 dice que si
 *  funciono, que es trabajo de mas y una pregunta sin sentido. */
export function isApplicable(field: FormField, answers: readonly FieldAnswer[]): boolean {
  const rule = field.showIf;
  if (!rule) return true;

  // Los disparadores se evaluan con O: Q19 aplica si hubo behaviour of concern
  // o de harm, no hace falta que haya de los dos.
  return rule.fields.some((fieldId) => {
    const trigger = answers.find((answer) => answer.fieldId === fieldId);
    if (!trigger || trigger.status === 'unavailable' || trigger.values.length === 0) return false;
    if (rule.anyOf) return trigger.values.some((value) => rule.anyOf!.includes(value));
    if (rule.anyExcept) return trigger.values.some((value) => !rule.anyExcept!.includes(value));
    return true;
  });
}

export function answerFor(
  answers: readonly FieldAnswer[],
  fieldId: string,
): FieldAnswer | null {
  return answers.find((answer) => answer.fieldId === fieldId) ?? null;
}

/** Respuestas que pueden entrar al formulario final: lo documentado y lo que
 *  confirmaste. Lo demas queda como pendiente y se muestra aparte. */
export function usableAnswers(answers: readonly FieldAnswer[]): FieldAnswer[] {
  return answers.filter(
    (answer) =>
      (answer.status === 'documented' || answer.status === 'confirmed') &&
      answer.values.length > 0 &&
      !answer.values.every(isUnavailable),
  );
}

/** Campos que aplican y todavia no tienen respuesta usable. */
export function missingFields(
  fields: readonly FormField[],
  answers: readonly FieldAnswer[],
): FormField[] {
  const usable = new Set(usableAnswers(answers).map((answer) => answer.fieldId));
  return fields.filter((field) => isApplicable(field, answers) && !usable.has(field.id));
}

/** Texto listo para pegar en el formulario, una pregunta por bloque.
 *
 *  Ordenado por numero de pregunta: las respuestas se guardan en el orden en que
 *  se fueron contestando, y leer un formulario salteado no sirve para revisarlo
 *  contra la pantalla. */
export function renderForForm(answers: readonly FieldAnswer[]): string {
  const newline = String.fromCharCode(10);
  return usableAnswers(answers)
    .map((answer) => {
      const field = findField(answer.fieldId);
      return field ? { field, answer } : null;
    })
    .filter((entry): entry is { field: FormField; answer: FieldAnswer } => entry !== null)
    .sort((a, b) => a.field.number - b.field.number)
    .map(({ field, answer }) => `Q${field.number} - ${field.label}${newline}${answer.values.join('; ')}`)
    .join(newline + newline);
}
