/** El marcador que llena el formulario en tu navegador.
 *
 *  Las respuestas viajan adentro del marcador. Se probo la alternativa de que
 *  las leyera del servidor local, para no tener que recopiarlo cada turno, pero
 *  Chrome bloquea toda peticion de una pagina HTTPS hacia localhost por Private
 *  Network Access, y no se levanta con cabeceras CORS. Llevar los datos dentro
 *  no depende de red ni de permisos: funciona siempre.
 *
 *  Lo que NUNCA hace es enviar. Deja el formulario lleno y ahi se detiene: el
 *  Submit lo apretas vos despues de revisar. Un test verifica que el codigo no
 *  toque el boton de envio. */

import { findField } from './schema.ts';
import { usableAnswers, type FieldAnswer } from './answers.ts';

/** Hosts del formulario. El marcador se niega a correr en cualquier otro lado,
 *  para no volcar datos de Josh en una pagina que no es la suya. */
export const FORM_HOSTS = ['forms.cloud.microsoft', 'forms.office.com'] as const;

/** Una respuesta lista para volcar: numero de pregunta y valores. */
export interface FillAnswer {
  readonly number: number;
  readonly values: readonly string[];
}

/** Solo lo documentado y lo confirmado, ordenado por numero de pregunta. */
export function fillAnswers(answers: readonly FieldAnswer[]): FillAnswer[] {
  return usableAnswers(answers)
    .map((answer) => {
      const field = findField(answer.fieldId);
      return field ? { number: field.number, values: answer.values } : null;
    })
    .filter((answer): answer is FillAnswer => answer !== null)
    .sort((a, b) => a.number - b.number);
}

/** Fuente del marcador. Va en una sola cadena y sin dependencias porque termina
 *  metida en el `href` de un marcador, donde no hay modulos ni build. */
const SOURCE = `(async () => {
  const HOSTS = __HOSTS__;
  const ANSWERS = __ANSWERS__;
  const LABEL = __LABEL__;

  if (!HOSTS.some((h) => location.hostname === h)) {
    alert('Abri primero el formulario de Joshua y despues toca el marcador.');
    return;
  }

  // Los inputs de Forms los controla React: cambiar .value a mano no dispara su
  // onChange. Hay que usar el setter nativo y emitir el evento.
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Forms virtualiza: los controles de una pregunta solo existen mientras esta
  // cerca del viewport. Hay que traerla a la vista y volver a buscarla antes de
  // tocarla, o se llenan solo las que estaban visibles al empezar.
  const findItem = (n) =>
    Array.from(document.querySelectorAll('[data-automation-id="questionItem"]')).find((item) => {
      const ord = item.querySelector('[data-automation-id="questionOrdinal"]');
      return parseInt(((ord && ord.textContent) || '').trim(), 10) === n;
    });

  const TEXT_SELECTOR =
    '[data-automation-id="textInput"], textarea, input[type="text"], input[type="date"], [data-automation-id="dateInput"]';

  const controlsOf = (item) => ({
    // Por data-automation-id y no por [type="text"]: algunos inputs de Forms no
    // traen el atributo type, y el selector por atributo no los agarra aunque la
    // propiedad .type diga "text".
    field: item.querySelector(TEXT_SELECTOR),
    // Las opciones normales vienen envueltas en choiceItem. Q20 (la escala de
    // intensidad) es otro tipo de pregunta y no las envuelve: ahi hay que ir a
    // los roles y leer su aria-label.
    choices: Array.from(item.querySelectorAll('[data-automation-id="choiceItem"]')),
    controls: Array.from(item.querySelectorAll('[role="radio"], [role="checkbox"]')),
  });

  /** Trae la pregunta a la vista, espera a que monte su control y devuelve los
   *  controles ya encontrados.
   *
   *  Devuelve los controles y no el contenedor a proposito: React reemplaza el
   *  nodo mientras monta, y volver a consultarlo despues de validarlo daba null
   *  sobre un elemento ya desconectado. */
  const reveal = async (n) => {
    const first = findItem(n);
    if (!first) return null;
    first.scrollIntoView({ block: 'center' });
    for (let i = 0; i < 15; i += 1) {
      await sleep(120);
      const fresh = findItem(n);
      if (!fresh) continue;
      const c = controlsOf(fresh);
      if (c.field || c.choices.length || c.controls.length) return c;
    }
    const last = findItem(n);
    return last ? controlsOf(last) : null;
  };

  const labelOf = (el) =>
    el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || '';

  const filled = [];
  const skipped = [];

  for (const answer of ANSWERS) {
    const found = await reveal(answer.number);
    if (!found) { skipped.push('Q' + answer.number + ': no esta en la pagina'); continue; }
    const values = answer.values || [];
    if (values.length === 0) continue;

    const { field, choices, controls } = found;

    // Las opciones van primero. Una pregunta de seleccion multiple tambien tiene
    // un input de texto (el de "Other"), y preferirlo escribia las conductas
    // dentro de esa casilla en vez de tildarlas.
    if (choices.length === 0 && controls.length === 0) {
      if (!field) { skipped.push('Q' + answer.number + ': sin control'); continue; }
      const text = values.join('; ');
      // Escribir y verificar, con reintento. React engancha su onChange un
      // instante despues de montar el input: si se escribe en esa ventana, el
      // texto entra al DOM y el siguiente render lo borra. Las preguntas de mas
      // abajo caian siempre ahi y quedaban vacias.
      let stuck = false;
      for (let attempt = 0; attempt < 5 && !stuck; attempt += 1) {
        const item = findItem(answer.number);
        const input = item && item.querySelector(TEXT_SELECTOR);
        if (input) {
          setValue(input, text);
          await sleep(200);
          const after = findItem(answer.number);
          const check = after && after.querySelector(TEXT_SELECTOR);
          stuck = Boolean(check && check.value === text);
        } else {
          await sleep(200);
        }
      }
      if (stuck) filled.push('Q' + answer.number);
      else skipped.push('Q' + answer.number + ': el texto no quedo, cargalo a mano');
      continue;
    }

    const wanted = values.map(norm);
    let hit = 0;
    for (const value of values) {
      const choice = choices.find((c) => norm(c.innerText).startsWith(norm(value)));
      const control = choice
        ? choice.querySelector('[role="radio"], [role="checkbox"], input') || choice
        : controls.find((c) => norm(labelOf(c)) === norm(value));

      if (!control) { skipped.push('Q' + answer.number + ': no encontre "' + value + '"'); continue; }
      if (control.getAttribute('aria-checked') !== 'true') control.click();
      hit += 1;
      await sleep(60);
    }

    // Relee lo que quedo marcado y destilda lo que sobre. Al tocar una casilla,
    // Forms a veces marca tambien "Other", y un tilde de mas en una conducta de
    // Josh no es un detalle cosmetico.
    const current = findItem(answer.number);
    if (current) {
      for (const control of Array.from(current.querySelectorAll('[aria-checked="true"]'))) {
        const wrap = control.closest('[data-automation-id="choiceItem"]');
        const text = norm(wrap ? wrap.innerText : labelOf(control));
        if (!wanted.some((w) => text.startsWith(w))) {
          control.click();
          skipped.push('Q' + answer.number + ': destilde "' + text + '", que no correspondia');
          await sleep(60);
        }
      }
    }
    if (hit) filled.push('Q' + answer.number);
  }

  // Repaso final sobre el formulario ya quieto: lo que se escribio temprano pudo
  // haberse perdido en un re-render posterior, y es mejor avisarlo que dejarlo
  // pasar en silencio.
  const lost = [];
  for (const answer of ANSWERS) {
    const item = findItem(answer.number);
    if (!item) continue;
    const input = item.querySelector(TEXT_SELECTOR);
    const ticked = item.querySelectorAll('[aria-checked="true"]').length;
    const expected = (answer.values || []).join('; ');
    if (!expected) continue;
    if (input && !ticked && input.value !== expected) lost.push('Q' + answer.number);
    if (!input && !ticked) lost.push('Q' + answer.number);
  }

  window.scrollTo({ top: 0 });
  const lines = ['Formulario del turno ' + LABEL, '', 'Cargadas: ' + (filled.join(', ') || 'ninguna')];
  if (lost.length) lines.push('', 'REVISAR, quedaron vacias: ' + lost.join(', '));
  if (skipped.length) lines.push('', 'Sin cargar:', ...skipped.map((s) => '  - ' + s));
  lines.push('', 'Revisa todo y despues aprieta Submit vos.');
  alert(lines.join('\\n'));
})();`;

function render(answers: readonly FillAnswer[], label: string): string {
  return SOURCE.replace('__HOSTS__', JSON.stringify(FORM_HOSTS))
    .replace('__ANSWERS__', JSON.stringify(answers))
    .replace('__LABEL__', JSON.stringify(label));
}

/** La fuente ya resuelta, para inspeccionarla y testearla sin desarmar la URL. */
export function bookmarkletSource(answers: readonly FillAnswer[], label: string): string {
  return render(answers, label);
}

export function buildBookmarklet(answers: readonly FieldAnswer[], label: string): string {
  return `javascript:${encodeURIComponent(render(fillAnswers(answers), label))}`;
}
