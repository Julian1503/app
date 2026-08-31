/** Las 25 preguntas del Behaviour Recording and Monitoring Form for Joshua Jones.
 *
 *  Este archivo es el esquema primario de la herramienta. Todo lo demas -
 *  extraccion, huecos, salida final - se ordena por estos campos. No se redacta
 *  una narrativa y despues se la parte en preguntas: se llena el formulario.
 *
 *  Enunciados, tipos de control y opciones cotejados contra el formulario real
 *  el 23/08/2026. Las opciones estan textuales para que se puedan seleccionar sin
 *  interpretar. El formulario lo recibe el Behaviour Support Practitioner de
 *  Darling Downs Therapy Services.
 *
 *  Dos rarezas del formulario que no son errores de transcripcion:
 *    - Q20 enumera cuatro niveles de intensidad en el enunciado pero ofrece
 *      cinco opciones (1 a 5).
 *    - Q11 no lista "Other" en su texto, pero el control existe, y Q12 pregunta
 *      por el. */

/** Opciones que el formulario ofrece y que esta herramienta no muestra nunca.
 *
 *  Las cinco primeras las descarto vos por no corresponder a Josh; la sexta es
 *  la version de autolesion dentro de Q18 y sale por el mismo criterio. Un
 *  tilde de mas en cualquiera de estas queda en su historia clinica igual que
 *  uno real. */
export const EXCLUDED_OPTIONS: readonly string[] = [
  'Speaking of desire or intent to suicide.',
  'Speaking of desire or intent for self-injurious behaviour.',
  'Expressing an urge to bite others',
  'Excessive phone usage, including phone calls',
  'Engaging with family.',
  'Engaging in self-injurious behaviour.',
];

/** El formulario en vivo. Se abre en una pestaña aparte para llenarlo. */
export const FORM_URL =
  'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=a6sLeE3UXkqQg56CQnPSex__EFbVbppPhN2PX3aSf8dUQU0wNzE5MFNHUFRYOUkyWTVHTjhFUVlJNy4u&origin=QRCode';

export type FieldKind =
  | 'text'
  | 'longtext'
  /** Una sola opcion (radio en el formulario). */
  | 'choice'
  /** Varias opciones (checkbox en el formulario). */
  | 'multi';

/** Condicion de visibilidad: el campo solo aplica si algun disparador la cumple.
 *
 *  Existe para no preguntar de mas: Q16 pide por que la respuesta no funciono, y
 *  no tiene sentido si funciono. */
export interface ShowIf {
  /** Se evaluan con O: alcanza con que uno cumpla. */
  readonly fields: readonly string[];
  /** Se cumple si el disparador tiene alguno de estos valores. */
  readonly anyOf?: readonly string[];
  /** Se cumple si el disparador tiene algun valor fuera de estos. */
  readonly anyExcept?: readonly string[];
}

export interface FormField {
  readonly id: string;
  readonly number: number;
  /** Enunciado del formulario, resumido para la pantalla. */
  readonly label: string;
  readonly kind: FieldKind;
  readonly options: readonly string[];
  readonly showIf: ShowIf | null;
  /** Que el formulario lo exija no autoriza a completarlo solo. */
  readonly required: boolean;
}

const CALL_RANGES = ['0 - 5 times', '5 - 10 times', '10 - 15 times', 'Greater than 15 times.'];
const YES_NO_PARTIALLY = ['Yes', 'No', 'Partially'];
const NONE_NOTED = 'None noted';
const OTHER = 'Other';

/** Franjas de Q3. El formulario aclara que es el periodo en que trabajaste con
 *  Josh, no el horario del turno, asi que solo se propone cuando el turno entra
 *  entero en una franja. */
export const TIME_SLOTS: readonly { readonly label: string; readonly from: number; readonly to: number }[] = [
  { label: '6.00am to 9.00am', from: 6 * 60, to: 9 * 60 },
  { label: '9.00am to 12.00pm', from: 9 * 60, to: 12 * 60 },
  { label: '12.00pm to 3.00pm', from: 12 * 60, to: 15 * 60 },
  { label: '3.00pm to 6.00pm', from: 15 * 60, to: 18 * 60 },
  { label: '6.00pm to 10.00pm', from: 18 * 60, to: 22 * 60 },
];

/** La franja que contiene el turno entero, o null si lo cruza o queda fuera.
 *  Un turno 20:00-06:00 no entra en ninguna: eso es un hueco a preguntar. */
export function slotForShift(startMinute: number, endMinute: number): string | null {
  const slot = TIME_SLOTS.find((entry) => startMinute >= entry.from && endMinute <= entry.to);
  return slot ? slot.label : null;
}

function allowed(options: readonly string[]): string[] {
  return options.filter((option) => !EXCLUDED_OPTIONS.includes(option));
}

export const FORM_FIELDS: readonly FormField[] = [
  { id: 'q1', number: 1, label: 'Name of person completing this form', kind: 'text', options: [], showIf: null, required: true },
  { id: 'q2', number: 2, label: 'Date', kind: 'text', options: [], showIf: null, required: true },
  {
    id: 'q3',
    number: 3,
    label: 'What time did you work with Joshua?',
    kind: 'choice',
    options: TIME_SLOTS.map((slot) => slot.label),
    showIf: null,
    required: true,
  },
  {
    id: 'q4',
    number: 4,
    label: 'At home or in the community?',
    kind: 'choice',
    options: ['At home', 'In the community', 'Both at home and in the community'],
    showIf: null,
    required: true,
  },
  { id: 'q5', number: 5, label: 'What activities did Joshua engage in?', kind: 'longtext', options: [], showIf: null, required: true },
  {
    id: 'q6',
    number: 6,
    label: 'Phone calls to, or requests to call, the Public Trustee',
    kind: 'choice',
    options: CALL_RANGES,
    showIf: null,
    required: true,
  },
  {
    id: 'q7',
    number: 7,
    label: 'Phone calls to, or requests to call, his General Practitioner',
    kind: 'choice',
    options: CALL_RANGES,
    showIf: null,
    required: true,
  },
  {
    id: 'q8',
    number: 8,
    label: 'How many times did Joshua need verbal prompting back to task?',
    kind: 'choice',
    options: CALL_RANGES,
    showIf: null,
    required: true,
  },
  {
    id: 'q9',
    number: 9,
    label: 'Did Joshua require further prompting to remain on task?',
    kind: 'choice',
    options: ['No', 'Gestural Prompt', 'Physical Prompt'],
    showIf: null,
    required: true,
  },
  {
    id: 'q10',
    number: 10,
    label: 'Further prompting, additional detail',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q9'], anyOf: ['Gestural Prompt', 'Physical Prompt'] },
    required: false,
  },
  {
    id: 'q11',
    number: 11,
    label: 'Precursor behaviours',
    kind: 'multi',
    options: allowed([
      NONE_NOTED,
      'Scratching on surfaces with fingertips',
      'Audible swallowing',
      'Excessive phone usage, including phone calls',
      'Responding to auditory hallucinations',
      'Expressing an urge to bite others',
      OTHER,
    ]),
    showIf: null,
    required: true,
  },
  {
    id: 'q12',
    number: 12,
    label: 'Unlisted precursor behaviour, described',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q11'], anyOf: [OTHER] },
    required: false,
  },
  {
    id: 'q13',
    number: 13,
    label: 'Precursor behaviour: at what time, and how was Joshua engaged?',
    kind: 'text',
    options: [],
    showIf: { fields: ['q11'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q14',
    number: 14,
    label: 'Your response during the precursor behaviour',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q11'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q15',
    number: 15,
    label: 'Was your response successful in redirecting Joshua?',
    kind: 'choice',
    options: YES_NO_PARTIALLY,
    showIf: { fields: ['q11'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q16',
    number: 16,
    label: 'Why the response was not successful',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q15'], anyOf: ['No', 'Partially'] },
    required: false,
  },
  {
    id: 'q17',
    number: 17,
    label: 'Behaviours of Concern',
    kind: 'multi',
    options: allowed([
      NONE_NOTED,
      'Hyper fixated and repetitive behaviours.',
      'Avoidance.',
      'Speaking of desire or intent to suicide.',
      'Speaking of desire or intent for self-injurious behaviour.',
      'Excessive praying.',
      'Requesting pseudoscience for schizophrenia.',
      'Food gorging.',
      'Engaging with family.',
      'Exhibiting behaviours that isolates others.',
      OTHER,
    ]),
    showIf: null,
    required: true,
  },
  {
    id: 'q18',
    number: 18,
    label: 'Behaviours of Harm',
    kind: 'multi',
    options: allowed([
      NONE_NOTED,
      'Engaging in self-injurious behaviour.',
      'Attempting to engage women socially.',
      'Sending socially inappropriate content to others online.',
      'Absconding.',
      OTHER,
    ]),
    showIf: null,
    required: true,
  },
  {
    id: 'q19',
    number: 19,
    label: 'Describe the behaviour of concern or harm',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q20',
    number: 20,
    label: 'Intensity of behaviour',
    kind: 'choice',
    // El enunciado describe cuatro niveles pero el formulario ofrece cinco.
    options: ['1', '2', '3', '4', '5'],
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q21',
    number: 21,
    label: 'At what time was the behaviour, and where was Joshua?',
    kind: 'text',
    options: [],
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q22',
    number: 22,
    label: 'Your response during the behaviour of concern or harm',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q23',
    number: 23,
    label: 'Was your response successful in helping Joshua regulate?',
    kind: 'choice',
    options: YES_NO_PARTIALLY,
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  {
    id: 'q24',
    number: 24,
    label: 'Once Joshua was regulated, what did he do?',
    kind: 'longtext',
    options: [],
    showIf: { fields: ['q17', 'q18'], anyExcept: [NONE_NOTED] },
    required: false,
  },
  { id: 'q25', number: 25, label: 'Any other comments?', kind: 'longtext', options: [], showIf: null, required: false },
];

const BY_ID = new Map(FORM_FIELDS.map((field) => [field.id, field]));

export function findField(id: string): FormField | null {
  return BY_ID.get(id) ?? null;
}

export function isFieldId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

export { NONE_NOTED, OTHER };
