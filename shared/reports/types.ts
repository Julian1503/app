/** Tipos del reporte por turno. */

import type { FieldAnswer, Gap } from '../form/answers.ts';
import type { IsoDate, Shift } from '../types.ts';

/** Una conducta observada, con su medida y la nota de lo que efectivamente paso. */
export interface Observation {
  readonly behaviourId: string;
  /** Veces o minutos, segun la unidad de la conducta. `null` si no se contabilizo. */
  readonly value: number | null;
  /** Que paso, en tus palabras. Es la materia prima de la redaccion. */
  readonly note: string;
}

/** - `pending`   todavia no se redacto
 *  - `drafted`   hay texto redactado listo para revisar
 *  - `submitted` ya se cargo en el formulario */
export type ReportStatus = 'pending' | 'drafted' | 'submitted';

export interface ShiftReport {
  readonly shiftId: string;
  readonly date: IsoDate;
  readonly observations: readonly Observation[];
  /** Animo, sueño, apetito y participacion, elegidos con chips. Es la via
   *  rapida: alcanzan para sostener el reporte de un turno tranquilo sin
   *  escribir prosa. */
  readonly presentationTags: readonly string[];
  /** Texto libre, opcional: lo que no entra en ninguna etiqueta. */
  readonly presentation: string;
  /** Apoyos que brindaste. El formulario casi siempre lo pregunta. */
  readonly support: string;
  /** Respuestas del formulario: documentadas, confirmadas o no disponibles. */
  readonly formAnswers: readonly FieldAnswer[];
  /** Campos que faltan y conviene preguntar. */
  readonly gaps: readonly Gap[];
  /** Formulario final ya redactado, listo para pegar, pregunta por pregunta. */
  readonly draft: string | null;
  readonly draftedAt: string | null;
  readonly status: ReportStatus;
  readonly updatedAt: string;
}

/** Un turno con Josh y su reporte, si ya existe. */
export interface ReportEntry {
  readonly shift: Shift;
  readonly report: ShiftReport | null;
}

export function emptyReport(shiftId: string, date: IsoDate): ShiftReport {
  return {
    shiftId,
    date,
    observations: [],
    presentationTags: [],
    presentation: '',
    support: '',
    formAnswers: [],
    gaps: [],
    draft: null,
    draftedAt: null,
    status: 'pending',
    updatedAt: new Date().toISOString(),
  };
}

/** Un reporte sin conductas tildadas y sin presentacion no da para redactar nada:
 *  Claude tendria que inventar el contenido, que es exactamente lo que no hace. */
export function hasMaterial(report: ShiftReport): boolean {
  return (
    report.observations.length > 0 ||
    report.presentationTags.length > 0 ||
    report.presentation.trim().length > 0
  );
}
