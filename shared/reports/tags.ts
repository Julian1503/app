/** Etiquetas de presentacion: animo, sueño, apetito y participacion.
 *
 *  Existen para no tener que escribir prosa en cada turno. Un turno tranquilo se
 *  describe tocando cuatro chips, y de ahi sale un parrafo redactado. El campo
 *  de texto libre queda para lo que no entra en ninguna etiqueta.
 *
 *  `label` va en ingles porque viaja al prompt y termina en el reporte; `labelEs`
 *  es solo para la pantalla. */

export type TagGroup = 'mood' | 'sleep' | 'appetite' | 'engagement';

export interface PresentationTag {
  readonly id: string;
  readonly group: TagGroup;
  readonly label: string;
  readonly labelEs: string;
}

export const TAG_GROUPS: readonly TagGroup[] = ['mood', 'sleep', 'appetite', 'engagement'];

export const PRESENTATION_TAGS: readonly PresentationTag[] = [
  // Animo
  { id: 'settled', group: 'mood', label: 'settled', labelEs: 'tranquilo' },
  { id: 'unsettled', group: 'mood', label: 'unsettled', labelEs: 'inquieto' },
  { id: 'elevated', group: 'mood', label: 'elevated', labelEs: 'exaltado' },
  { id: 'flat', group: 'mood', label: 'flat in mood', labelEs: 'apagado' },
  { id: 'irritable', group: 'mood', label: 'irritable', labelEs: 'irritable' },

  // Sueño
  { id: 'slept-well', group: 'sleep', label: 'slept well', labelEs: 'durmio bien' },
  { id: 'broken-sleep', group: 'sleep', label: 'broken sleep', labelEs: 'sueño cortado' },
  { id: 'late-to-bed', group: 'sleep', label: 'late to bed', labelEs: 'se acosto tarde' },
  { id: 'awake-overnight', group: 'sleep', label: 'awake overnight', labelEs: 'despierto de noche' },

  // Apetito
  { id: 'ate-well', group: 'appetite', label: 'ate well', labelEs: 'comio bien' },
  { id: 'poor-appetite', group: 'appetite', label: 'poor appetite', labelEs: 'poco apetito' },
  {
    id: 'sought-extra-food',
    group: 'appetite',
    label: 'sought extra food',
    labelEs: 'buscaba mas comida',
  },

  // Participacion
  { id: 'engaged', group: 'engagement', label: 'engaged in activities', labelEs: 'participo' },
  { id: 'withdrawn', group: 'engagement', label: 'withdrawn', labelEs: 'retraido' },
  {
    id: 'declined-activities',
    group: 'engagement',
    label: 'declined activities',
    labelEs: 'rechazo actividades',
  },
  {
    id: 'accepted-redirection',
    group: 'engagement',
    label: 'accepted redirection',
    labelEs: 'acepto redireccion',
  },
];

const BY_ID = new Map(PRESENTATION_TAGS.map((tag) => [tag.id, tag]));

export function findTag(id: string): PresentationTag | null {
  return BY_ID.get(id) ?? null;
}

export function isTagId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

export const TAG_IDS: readonly string[] = PRESENTATION_TAGS.map((tag) => tag.id);
