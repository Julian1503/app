/** Vocabulario de conductas del formulario de reporte de turno.
 *
 *  La lista es cerrada a proposito: el formulario ofrece muchas mas opciones,
 *  pero solo estas aplican a este cliente. Tener el resto a mano en la pantalla
 *  invita a tildar algo que no paso, y una conducta tildada de mas queda en su
 *  historia clinica igual que una real. */

export type BehaviourUnit = 'times' | 'minutes';

export interface Behaviour {
  readonly id: string;
  /** Etiqueta en ingles, tal cual figura en el formulario. No se traduce: se
   *  copia y pega a un formulario australiano. */
  readonly label: string;
  /** Como se mide. Define el sufijo del campo numerico y como lo lee el prompt. */
  readonly unit: BehaviourUnit;
  /** Que mirar para no confundirla con otra. Se muestra debajo del checkbox. */
  readonly hint: string;
  /** Pregunta del formulario donde vive esta conducta.
   *
   *  `q11` precursoras, `q17` behaviours of concern, `q18` behaviours of harm.
   *  Cotejado contra el formulario real: `Avoidance.` vive en Q17 y no en Q11,
   *  al reves de lo que parecia. */
  readonly formField: 'q11' | 'q17' | 'q18';
  /** true si la ubicacion viene del formulario. Todas lo son desde que se
   *  cotejo el formulario real el 23/08/2026. */
  readonly fieldConfirmed: boolean;
  /** Contextos frecuentes, tomados de los comentarios que ya escribis en Deputy.
   *  Se tocan para llenar la nota en vez de tipearla. Van en ingles porque son
   *  la nota misma, y la nota termina en el reporte. */
  readonly contexts: readonly string[];
}

export const BEHAVIOURS: readonly Behaviour[] = [
  {
    id: 'excessive-praying',
    label: 'Excessive praying.',
    unit: 'minutes',
    hint: 'Tiempo total rezando durante el turno, no cantidad de veces.',
    formField: 'q17',
    fieldConfirmed: true,
    contexts: [
      'searching for prayers on the TV',
      'praying in his room',
      'praying before meals',
    ],
  },
  {
    id: 'pseudoscience-request',
    label: 'Requesting pseudoscience for schizophrenia.',
    unit: 'times',
    hint: 'Cada vez que pidio un tratamiento sin respaldo para la esquizofrenia.',
    formField: 'q17',
    fieldConfirmed: true,
    contexts: [
      'asked for a cure for schizophrenia',
      'asked about a supplement or remedy',
      'asked to stop his medication',
    ],
  },
  {
    id: 'food-gorging',
    label: 'Food gorging.',
    unit: 'times',
    hint: 'Episodios de comer en exceso o muy rapido.',
    formField: 'q17',
    fieldConfirmed: true,
    contexts: [
      'repeatedly searched for snacks',
      'ate very quickly',
      'sought extra servings',
    ],
  },
  {
    id: 'hyper-fixation',
    label: 'Hyper fixated and repetitive behaviours.',
    unit: 'minutes',
    hint: 'Tiempo sostenido en la fijacion. Anota en la nota sobre que fue.',
    formField: 'q17',
    fieldConfirmed: true,
    contexts: [
      'fixated on his broken phone',
      'repeated the same question',
      'extended time on the PlayStation',
    ],
  },
  {
    id: 'avoidance',
    label: 'Avoidance.',
    unit: 'minutes',
    hint: 'Tiempo evitando una actividad, tarea o interaccion propuesta.',
    formField: 'q17',
    fieldConfirmed: true,
    contexts: [
      'declined to leave the house',
      'avoided personal care',
      'avoided the proposed activity',
    ],
  },
  {
    id: 'surface-scratching',
    label: 'Scratching on surfaces with fingertips',
    unit: 'times',
    hint: 'Episodios de rascar superficies con la yema de los dedos.',
    formField: 'q11',
    fieldConfirmed: true,
    contexts: [
      'scratching the couch',
      'scratching the table',
      'scratching the wall',
    ],
  },
  {
    id: 'audible-swallowing',
    label: 'Audible swallowing',
    unit: 'times',
    hint: 'Episodios de deglucion audible.',
    formField: 'q11',
    fieldConfirmed: true,
    contexts: [
      'audible swallowing while seated',
      'audible swallowing during meals',
    ],
  },
  {
    id: 'auditory-hallucinations',
    label: 'Responding to auditory hallucinations',
    unit: 'times',
    hint: 'Cada vez que respondio a voces: hablar solo, girar hacia un sonido.',
    formField: 'q11',
    fieldConfirmed: true,
    contexts: [
      'talking to himself',
      'responded to voices',
      'turned towards a sound with no source',
    ],
  },
];

/** Conductas que el formulario ofrece y que aca no se muestran nunca, con el
 *  motivo. Documentarlas evita que alguien "complete" el catalogo mas adelante
 *  sin saber por que faltaban. Los tests verifican que ninguna se filtre. */
export const EXCLUDED_BEHAVIOURS: readonly { readonly label: string; readonly reason: string }[] = [
  { label: 'Speaking of desire or intent to suicide', reason: 'No ocurre con este cliente.' },
  {
    label: 'Speaking of desire or intent for self-injurious behaviour',
    reason: 'No ocurre con este cliente.',
  },
  { label: 'Expressing an urge to bite others', reason: 'No ocurre con este cliente.' },
  {
    label: 'Excessive phone usage, including phone calls',
    reason: 'No tiene telefono, asi que no puede ocurrir.',
  },
  { label: 'Engaging with family', reason: 'No aplica a este cliente.' },
];

const BY_ID = new Map(BEHAVIOURS.map((behaviour) => [behaviour.id, behaviour]));

export function findBehaviour(id: string): Behaviour | null {
  return BY_ID.get(id) ?? null;
}

export function isBehaviourId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

export const BEHAVIOUR_IDS: readonly string[] = BEHAVIOURS.map((behaviour) => behaviour.id);
