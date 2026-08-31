import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isApplicable,
  missingFields,
  renderForForm,
  usableAnswers,
  type FieldAnswer,
} from '../shared/form/answers.js';
import {
  EXCLUDED_OPTIONS,
  FORM_FIELDS,
  findField,
  slotForShift,
} from '../shared/form/schema.js';
import { BEHAVIOURS, EXCLUDED_BEHAVIOURS, isBehaviourId } from '../shared/reports/behaviours.js';
import { matchesClient, selectClientShifts } from '../shared/reports/select.js';
import { PRESENTATION_TAGS, isTagId } from '../shared/reports/tags.js';
import { emptyReport, hasMaterial } from '../shared/reports/types.js';
import type { Shift } from '../shared/types.js';
import {
  bookmarkletSource,
  buildBookmarklet,
  fillAnswers,
} from '../shared/form/bookmarklet.js';
import { EXTRACT_SYSTEM } from '../server/form/extract.js';
import { FINALISE_SYSTEM } from '../server/form/finalise.js';
import {
  parseFormAnswers,
  parseGaps,
  parseObservations,
  parseStatus,
  parseTags,
} from '../server/reports/store.js';

function shift(date: string, area: string | null, overrides: Partial<Shift> = {}): Shift {
  return {
    id: `timesheet:${date}`,
    source: 'timesheet',
    date,
    startMinute: 8 * 60,
    endMinute: 16 * 60,
    area,
    employeeComment: null,
    approved: true,
    kmDeclared: null,
    ...overrides,
  };
}

const OPTIONS = { clientName: 'Joshua Jones', from: '2026-08-16', today: '2026-08-22' };

// --- Seleccion de turnos ---

test('el location se compara sin importar mayusculas ni sufijos', () => {
  assert.equal(matchesClient('Joshua Jones', 'Joshua Jones'), true);
  assert.equal(matchesClient('JOSHUA JONES - Community', 'Joshua Jones'), true);
  assert.equal(matchesClient('  joshua   jones  ', 'Joshua Jones'), true);
});

test('otro cliente no entra', () => {
  assert.equal(matchesClient('John Smith', 'Joshua Jones'), false);
  assert.equal(matchesClient(null, 'Joshua Jones'), false);
});

test('solo entran los turnos del cliente ya completados desde el 16 de agosto', () => {
  const shifts = [
    shift('2026-08-17', 'Joshua Jones'),
    shift('2026-08-15', 'Joshua Jones'), // anterior al inicio
    shift('2026-08-18', 'John Smith'), // otro cliente
    shift('2026-08-22', 'Joshua Jones'), // hoy: todavia no termino
    shift('2026-08-25', 'Joshua Jones'), // futuro
  ];

  const selected = selectClientShifts(shifts, OPTIONS);
  assert.deepEqual(
    selected.map((entry) => entry.date),
    ['2026-08-17'],
  );
});

test('un roster no lleva reporte: es un turno que todavia no se trabajo', () => {
  const shifts = [shift('2026-08-17', 'Joshua Jones', { source: 'roster' })];
  assert.equal(selectClientShifts(shifts, OPTIONS).length, 0);
});

test('los turnos salen del mas reciente al mas viejo', () => {
  const shifts = [
    shift('2026-08-17', 'Joshua Jones'),
    shift('2026-08-20', 'Joshua Jones'),
    shift('2026-08-18', 'Joshua Jones'),
  ];
  assert.deepEqual(
    selectClientShifts(shifts, OPTIONS).map((entry) => entry.date),
    ['2026-08-20', '2026-08-18', '2026-08-17'],
  );
});

// --- Catalogo de conductas ---

test('las conductas excluidas no estan en el catalogo', () => {
  const labels = new Set(BEHAVIOURS.map((behaviour) => behaviour.label.toLowerCase()));
  for (const excluded of EXCLUDED_BEHAVIOURS) {
    assert.equal(
      labels.has(excluded.label.toLowerCase()),
      false,
      `"${excluded.label}" no deberia estar disponible: ${excluded.reason}`,
    );
  }
});

test('ninguna conducta del catalogo menciona autolesion, suicidio ni telefono', () => {
  const forbidden = /self[- ]harm|self[- ]injur|suicid|bite|phone|family/i;
  for (const behaviour of BEHAVIOURS) {
    assert.equal(forbidden.test(behaviour.label), false, `catalogo contaminado: ${behaviour.label}`);
  }
});

// --- Normalizacion de lo que manda la UI ---

test('una conducta desconocida se descarta en vez de guardarse', () => {
  const parsed = parseObservations([
    { behaviourId: 'excessive-praying', value: 2, note: 'antes de comer' },
    { behaviourId: 'self-harm', value: 9, note: 'inventado' },
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.behaviourId, 'excessive-praying');
});

test('un valor negativo o no numerico queda como sin contabilizar', () => {
  const parsed = parseObservations([
    { behaviourId: 'food-gorging', value: -3, note: '' },
    { behaviourId: 'avoidance', value: 'cinco', note: '' },
  ]);
  assert.deepEqual(
    parsed.map((observation) => observation.value),
    [null, null],
  );
});

test('un estado invalido cae al que ya tenia', () => {
  assert.equal(parseStatus('enviado', 'drafted'), 'drafted');
  assert.equal(parseStatus('submitted', 'pending'), 'submitted');
});

test('isBehaviourId reconoce solo el catalogo', () => {
  assert.equal(isBehaviourId('audible-swallowing'), true);
  assert.equal(isBehaviourId('excessive-phone-usage'), false);
});

// --- Material minimo ---

test('un reporte sin conductas, etiquetas ni presentacion no da para redactar', () => {
  const report = emptyReport('timesheet:1', '2026-08-17');
  assert.equal(hasMaterial(report), false);
  // Cuatro chips alcanzan: es la via rapida para un turno tranquilo.
  assert.equal(hasMaterial({ ...report, presentationTags: ['settled'] }), true);
  assert.equal(hasMaterial({ ...report, presentation: 'Tranquilo toda la tarde.' }), true);
  assert.equal(
    hasMaterial({
      ...report,
      observations: [{ behaviourId: 'avoidance', value: 20, note: '' }],
    }),
    true,
  );
});

// --- Etiquetas de presentacion ---

test('las etiquetas desconocidas se descartan y las repetidas se colapsan', () => {
  assert.deepEqual(parseTags(['settled', 'inventada', 'settled', 'ate-well']), [
    'settled',
    'ate-well',
  ]);
  assert.deepEqual(parseTags('settled'), []);
});

test('cada etiqueta pertenece a un grupo conocido y tiene las dos leyendas', () => {
  for (const tag of PRESENTATION_TAGS) {
    assert.ok(isTagId(tag.id));
    assert.ok(tag.label.length > 0, `${tag.id} sin leyenda en ingles`);
    assert.ok(tag.labelEs.length > 0, `${tag.id} sin leyenda en espanol`);
  }
});


// --- Esquema del formulario ---

test('el esquema tiene las 25 preguntas, numeradas y sin huecos', () => {
  assert.equal(FORM_FIELDS.length, 25);
  assert.deepEqual(
    FORM_FIELDS.map((field) => field.number),
    Array.from({ length: 25 }, (_, index) => index + 1),
  );
});

test('las opciones son las del formulario, textuales', () => {
  const ranges = ['0 - 5 times', '5 - 10 times', '10 - 15 times', 'Greater than 15 times.'];
  assert.deepEqual(findField('q6')!.options, ranges);
  assert.deepEqual(findField('q7')!.options, ranges);
  // Q8 es un rango de veces, no un si/no.
  assert.deepEqual(findField('q8')!.options, ranges);
  assert.deepEqual(findField('q9')!.options, ['No', 'Gestural Prompt', 'Physical Prompt']);
  assert.deepEqual(findField('q15')!.options, ['Yes', 'No', 'Partially']);
  assert.deepEqual(findField('q23')!.options, ['Yes', 'No', 'Partially']);
  assert.deepEqual(findField('q4')!.options, [
    'At home',
    'In the community',
    'Both at home and in the community',
  ]);
});

test('Q20 ofrece cinco niveles aunque el enunciado describa cuatro', () => {
  // Rareza del formulario real, no un error de transcripcion.
  assert.deepEqual(findField('q20')!.options, ['1', '2', '3', '4', '5']);
});

test('Q3 es una franja elegible, no el horario del turno', () => {
  assert.equal(findField('q3')!.kind, 'choice');
  assert.equal(slotForShift(6 * 60, 9 * 60), '6.00am to 9.00am');
  // Un turno que cruza franjas, o que cae fuera, no se autocompleta.
  assert.equal(slotForShift(8 * 60, 13 * 60), null);
  assert.equal(slotForShift(20 * 60, 30 * 60), null);
});

test('las conductas caen en la pregunta que dice el formulario', () => {
  const q11 = findField('q11')!.options;
  const q17 = findField('q17')!.options;
  assert.ok(q11.includes('Responding to auditory hallucinations'));
  assert.ok(q11.includes('Audible swallowing'));
  assert.ok(q17.includes('Hyper fixated and repetitive behaviours.'));
  // Avoidance es behaviour of concern, no precursora: parecia al reves.
  assert.ok(q17.includes('Avoidance.'));
  assert.equal(q11.includes('Avoidance.'), false);
  // "None noted" es la respuesta correcta cuando no hubo nada, y existe.
  assert.ok(q11.includes('None noted') && q17.includes('None noted'));
  assert.ok(q11.includes('Other') && q17.includes('Other'));
});

test('el catalogo de carga manual usa las etiquetas exactas del formulario', () => {
  for (const behaviour of BEHAVIOURS) {
    const field = findField(behaviour.formField)!;
    assert.ok(
      field.options.includes(behaviour.label),
      `"${behaviour.label}" no figura en ${behaviour.formField}`,
    );
    assert.equal(behaviour.fieldConfirmed, true);
  }
});

test('las opciones excluidas no llegan a ninguna pregunta del formulario', () => {
  const all = FORM_FIELDS.flatMap((field) => field.options);
  for (const excluded of EXCLUDED_OPTIONS) {
    assert.equal(all.includes(excluded), false, `"${excluded}" no deberia estar disponible`);
  }
  // Incluye la autolesion de Q18, que sale por el mismo criterio.
  assert.ok(EXCLUDED_OPTIONS.includes('Engaging in self-injurious behaviour.'));
});

test('las opciones nuevas del formulario si estan disponibles', () => {
  assert.ok(findField('q17')!.options.includes('Exhibiting behaviours that isolates others.'));
  assert.ok(findField('q18')!.options.includes('Absconding.'));
  assert.ok(findField('q18')!.options.includes('Attempting to engage women socially.'));
});

// --- Respuestas y condiciones ---

function answer(fieldId: string, values: string[], status: FieldAnswer['status']): FieldAnswer {
  return { fieldId, values, status, evidence: '' };
}

test('un campo condicional no aplica hasta que su disparador lo habilita', () => {
  const q16 = findField('q16')!;
  assert.equal(isApplicable(q16, []), false);
  assert.equal(isApplicable(q16, [answer('q15', ['Yes'], 'documented')]), false);
  assert.equal(isApplicable(q16, [answer('q15', ['Partially'], 'confirmed')]), true);
  assert.equal(isApplicable(q16, [answer('q15', ['No'], 'confirmed')]), true);
});

test('"None noted" no dispara las preguntas de seguimiento', () => {
  const q13 = findField('q13')!;
  assert.equal(isApplicable(q13, [answer('q11', ['None noted'], 'documented')]), false);
  assert.equal(isApplicable(q13, [answer('q11', ['Audible swallowing'], 'documented')]), true);
});

test('las preguntas de conducta se abren con Q17 o con Q18, indistintamente', () => {
  const q19 = findField('q19')!;
  assert.equal(isApplicable(q19, [answer('q17', ['None noted'], 'documented')]), false);
  assert.equal(isApplicable(q19, [answer('q18', ['Absconding.'], 'confirmed')]), true);
  assert.equal(isApplicable(q19, [answer('q17', ['Avoidance.'], 'documented')]), true);
});

test('un campo sin condicion siempre aplica', () => {
  assert.equal(isApplicable(findField('q5')!, []), true);
});

test('solo lo documentado y lo confirmado es usable', () => {
  const answers = [
    answer('q5', ['Went to the shops'], 'documented'),
    answer('q15', ['Partially'], 'confirmed'),
    answer('q20', ['Not recorded'], 'unavailable'),
    answer('q21', [], 'documented'),
  ];
  assert.deepEqual(
    usableAnswers(answers).map((entry) => entry.fieldId),
    ['q5', 'q15'],
  );
});

test('una salida de "no se puede saber" nunca cuenta como respuesta', () => {
  assert.deepEqual(usableAnswers([answer('q20', ['Unable to recall'], 'documented')]), []);
});

test('los obligatorios que faltan se cuentan, salteando los condicionales dormidos', () => {
  const required = FORM_FIELDS.filter((field) => field.required);
  const missing = missingFields(required, [answer('q1', ['Joshua Jones'], 'documented')]);
  assert.equal(missing.some((field) => field.id === 'q1'), false);
  assert.equal(missing.some((field) => field.id === 'q16'), false);
});

test('la salida se arma por pregunta, con su numero y su enunciado', () => {
  const text = renderForForm([
    answer('q15', ['Partially'], 'confirmed'),
    answer('q20', ['Not known'], 'unavailable'),
  ]);
  assert.ok(text.includes('Q15 - Was your response successful in redirecting Joshua?'));
  assert.ok(text.includes('Partially'));
  assert.equal(text.includes('Q20'), false);
});

test('la salida va ordenada por numero, no por orden de respuesta', () => {
  // Se guardan en el orden en que se contestan, que no es el del formulario.
  const text = renderForForm([
    answer('q9', ['No'], 'confirmed'),
    answer('q1', ['Julian'], 'documented'),
    answer('q15', ['Yes'], 'confirmed'),
    answer('q4', ['At home'], 'confirmed'),
  ]);
  const order = [...text.matchAll(/Q(\d+) - /g)].map((m) => Number(m[1]));
  assert.deepEqual(order, [1, 4, 9, 15]);
});

// --- Prompts de las dos etapas ---

test('el prompt de extraccion prohibe ascender una actividad a categoria', () => {
  assert.ok(EXTRACT_SYSTEM.includes('is NOT automatically "Excessive praying"'));
  assert.match(EXTRACT_SYSTEM, /do not select the option/);
  assert.match(EXTRACT_SYSTEM, /Raise a gap asking the worker to confirm the/);
});

test('el prompt de extraccion prohibe inventar y no deja completar por obligatorio', () => {
  assert.match(EXTRACT_SYSTEM, /Never invent a frequency, duration, intensity, time, location/);
  assert.match(EXTRACT_SYSTEM, /A field being required does not permit you to fill it/);
});

test('el prompt de extraccion si extrae lo que la nota ya dice', () => {
  assert.ok(EXTRACT_SYSTEM.includes('re-enter what they already wrote'));
  assert.ok(EXTRACT_SYSTEM.includes('q15 = Partially'));
});

test('el prompt de extraccion no deja deducir un rango de una sola mencion', () => {
  assert.ok(EXTRACT_SYSTEM.includes('are ranges, not yes'));
  assert.ok(EXTRACT_SYSTEM.includes('is not evidence that the'));
});

test('el prompt de extraccion sabe que "None noted" es una respuesta valida', () => {
  assert.ok(EXTRACT_SYSTEM.includes('It is a real answer, not a fallback'));
});

test('el prompt de extraccion lleva las 25 preguntas con sus opciones y condiciones', () => {
  assert.ok(EXTRACT_SYSTEM.includes('q20 (Q20) Intensity of behaviour'));
  assert.ok(EXTRACT_SYSTEM.includes('0 - 5 times | 5 - 10 times'));
  assert.ok(EXTRACT_SYSTEM.includes('Only applies when q15 is one of: No | Partially'));
  assert.ok(EXTRACT_SYSTEM.includes('Only applies when q17 or q18 has a selection other than'));
});

test('el prompt final redacta por campo y no arma una narrativa', () => {
  assert.match(FINALISE_SYSTEM, /This is form completion, not a narrative/);
  assert.match(FINALISE_SYSTEM, /do not repeat one field/);
});

test('el prompt final mantiene las prohibiciones de relleno generico', () => {
  for (const banned of ['presented as', 'slept well', 'ate well', 'no further concerns']) {
    assert.ok(FINALISE_SYSTEM.includes(banned), `falta prohibir "${banned}"`);
  }
});

// --- Normalizacion de lo que vuelve del modelo ---

test('una respuesta a un campo inexistente se descarta', () => {
  const parsed = parseFormAnswers([
    { fieldId: 'q15', values: ['Partially'], status: 'documented', evidence: 'x' },
    { fieldId: 'q99', values: ['inventado'], status: 'documented', evidence: '' },
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.fieldId, 'q15');
});

test('un status invalido cae a documentado', () => {
  const parsed = parseFormAnswers([
    { fieldId: 'q5', values: ['x'], status: 'inventado', evidence: '' },
  ]);
  assert.equal(parsed[0]!.status, 'documented');
});

test('un hueco sin campo valido o sin pregunta se descarta', () => {
  assert.equal(parseGaps([{ fieldId: 'q99', question: '?' }, { fieldId: 'q13' }]).length, 0);
  assert.equal(parseGaps([{ fieldId: 'q13', question: 'When?' }]).length, 1);
});

// --- Marcador que llena el formulario ---

test('el marcador nunca toca el boton de envio', () => {
  const source = bookmarkletSource([{ number: 5, values: ['x'] }], '2026-08-17');
  // Ni por automation-id ni por texto: el Submit lo aprieta el trabajador.
  assert.equal(source.includes('submitButton'), false);
  assert.equal(/\.submit\(\)/.test(source), false);
  assert.equal(/click\(\)[^;]*submit/i.test(source), false);
});

test('el marcador se niega a correr fuera del dominio del formulario', () => {
  const source = bookmarkletSource([], '2026-08-17');
  assert.ok(source.includes('forms.cloud.microsoft'));
  assert.ok(source.includes('location.hostname'));
});

test('el marcador solo lleva lo documentado y lo confirmado, ordenado', () => {
  const answers = [
    { fieldId: 'q20', values: ['2'], status: 'confirmed' as const, evidence: '' },
    { fieldId: 'q5', values: ['Went out'], status: 'documented' as const, evidence: '' },
    { fieldId: 'q21', values: ['Not recorded'], status: 'unavailable' as const, evidence: '' },
  ];
  assert.deepEqual(fillAnswers(answers), [
    { number: 5, values: ['Went out'] },
    { number: 20, values: ['2'] },
  ]);
});

test('el marcador sale como URL javascript: y con las respuestas adentro', () => {
  const url = buildBookmarklet(
    [{ fieldId: 'q4', values: ['At home'], status: 'confirmed', evidence: '' }],
    '2026-08-17',
  );
  assert.ok(url.startsWith('javascript:'));
  assert.ok(decodeURIComponent(url).includes('At home'));
});

test('el marcador reintenta el texto y avisa si no quedo', () => {
  const source = bookmarkletSource([{ number: 13, values: ['x'] }], '2026-08-18');
  // Escribir una vez no alcanza: React pisa lo que se escribio antes de tiempo.
  assert.ok(source.includes('attempt < 5'));
  assert.ok(source.includes('check.value === text'));
  assert.ok(source.includes('REVISAR, quedaron vacias'));
});

test('una respuesta vaciada no cuenta ni llega al formulario', () => {
  // La entrada se conserva en su lugar para no desmontar el input mientras
  // escribis, pero sin valores no es una respuesta.
  const vaciada = [answer('q13', [], 'confirmed'), answer('q5', ['Went out'], 'documented')];
  assert.deepEqual(
    usableAnswers(vaciada).map((entry) => entry.fieldId),
    ['q5'],
  );
  assert.equal(renderForForm(vaciada).includes('Q13'), false);
  assert.deepEqual(
    fillAnswers(vaciada).map((entry) => entry.number),
    [5],
  );
});
