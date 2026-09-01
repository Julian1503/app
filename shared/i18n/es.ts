/** Catalogo en español. Es la fuente de verdad de las claves: `en.ts` se tipa
 *  contra este archivo, asi que si falta una clave o un parametro cambia de
 *  forma, el typecheck lo marca antes de que llegue a la pantalla.
 *
 *  Las entradas con parametros reciben todo ya formateado (fechas, importes) para
 *  que el catalogo sea solo texto y no tenga que conocer formatos ni locales. */

export const es = {
  // --- Cascara de la app ---
  'app.documentTitle': 'Horas · control 8105 y auditoría de pagos',
  'app.eyebrow': 'Herramienta interna · condición 8105',
  'app.title': 'Horas y pagos',
  'app.loading': 'Cargando…',
  'app.language': 'Idioma',
  'app.languageName': 'Español',
  'app.error.unexpected': 'Error inesperado al cargar el reporte.',
  'app.error.sync': 'No se pudo sincronizar con Deputy.',
  'app.error.offline':
    'No se pudo contactar al servidor local. ¿Está corriendo `npm run dev`?',
  'app.error.auth': (p: { reason: string }) => `El login con Deputy falló: ${p.reason}`,
  'app.error.status': (p: { status: number }) => `Error ${p.status}`,

  // --- Barra de conexion ---
  'connect.missing.lead':
    'Faltan las credenciales OAuth. Registrá el cliente en once.deputy.com/my/oauth/list con redirect',
  'connect.missing.tail': 'y cargá DEPUTY_CLIENT_ID y DEPUTY_CLIENT_SECRET en el .env.',
  'connect.notAuthorised':
    'Todavía no autorizaste la app. El login ocurre en la página de Deputy.',
  'connect.login': 'Entrar con Deputy',
  'connect.session': 'Sesión activa',
  'connect.lastSync': (p: { when: string }) => `Último sync: ${p.when}`,
  'connect.never': 'nunca',
  'connect.syncing': 'Sincronizando…',
  'connect.sync': 'Sincronizar',
  'connect.logout': 'Salir',

  // --- Secciones ---
  'section.pay.title': 'Lo que vas a cobrar',
  'section.pay.note': (p: { taxYear: string }) =>
    `Semana de pago jueves a miércoles, depósito el jueves siguiente · año fiscal ${p.taxYear}`,
  'section.pay.back': 'volver al próximo pago',
  'section.weeks.title': 'Semana a semana',
  'section.weeks.note': (p: {
    year: string;
    gross: string;
    tax: string;
    superannuation: string;
    count: number;
  }) =>
    `Año fiscal ${p.year}: ${p.gross} brutos · ${p.tax} de impuesto · ${p.superannuation} de súper, sobre ${p.count} payslips`,
  'section.drop.title': 'Qué pedir que te saquen',
  'section.drop.note': (p: { count: number }) =>
    `${p.count} quincena${p.count === 1 ? '' : 's'} abierta${p.count === 1 ? '' : 's'} por encima del límite`,
  'section.findings.title': 'Hallazgos',
  'section.findings.note': (p: {
    count: number;
    shortfall: string;
    km: string;
    recovered: string;
    hasRecovered: boolean;
  }) =>
    `${p.count} en total · ${p.shortfall} de bruto que el roster dice que falta · ${p.km} en km sin reembolsar${
      p.hasRecovered ? ` · ${p.recovered} ya recuperados` : ''
    }`,
  'section.fortnights.title': 'Todas las quincenas',
  'section.fortnights.note': (p: { limit: number }) =>
    `Elegí una para verla arriba · ventanas de 14 días desde cada lunes · la marca vertical es el límite de ${p.limit} h`,
  'app.signOut': 'Salir',

  'tabs.fortnight': 'Quincena',
  'tabs.pay': 'Pagos',
  'tabs.review': 'Revisión',
  'tabs.reports': 'Reportes',

  'section.payslips.title': 'Payslips',
  'section.payslips.note': (p: { files: number; paid: number; roster: number }) =>
    `${p.files} archivos leídos · ${p.paid} h pagadas contra ${p.roster} h de roster`,
  'section.payslips.upload': 'Subir payslip',
  'section.payslips.uploading': 'Leyendo…',
  'section.payslips.uploaded': (p: { added: number; replaced: number; periods: string }) =>
    p.replaced > 0
      ? `Listo: ${p.added} periodo(s) nuevo(s) y ${p.replaced} actualizado(s). ${p.periods}`
      : `Listo: ${p.added} periodo(s) nuevo(s). ${p.periods}`,
  'section.payslips.failures': (p: { count: number; files: string }) =>
    `No se pudieron leer ${p.count} archivo(s): ${p.files}`,

  // --- Panel de la quincena ---
  'gauge.empty':
    'Todavía no hay turnos cargados. Sincronizá con Deputy para ver tu quincena vigente.',
  'gauge.position.past': 'Quincena cerrada',
  'gauge.position.current': 'Quincena vigente',
  'gauge.position.future': 'Quincena futura',
  'gauge.headline.pastUnder': (p: { hours: number }) => `Cerró con ${p.hours} h de margen`,
  'gauge.headline.pastOver': (p: { hours: number }) => `Cerró ${p.hours} h por encima`,
  'gauge.headline.left': (p: { hours: number }) => `Te quedan ${p.hours} h`,
  'gauge.headline.futureOver': (p: { hours: number }) =>
    `El roster te deja ${p.hours} h por encima`,
  'gauge.headline.currentOver': (p: { hours: number }) => `Te pasaste por ${p.hours} h`,
  'gauge.verdict.past.ok': 'Cerró dentro del límite.',
  'gauge.verdict.past.warning': 'Cerró al filo, pero dentro del límite.',
  'gauge.verdict.past.over':
    'Cerró por encima del límite. Ya no se corrige con el roster; sirve para saber dónde estás parado si alguna vez te lo preguntan.',
  'gauge.verdict.current.ok': 'Dentro del límite. No hace falta tocar nada.',
  'gauge.verdict.current.warning':
    'Al filo. Un turno más y te pasás: conviene no aceptar extras esta quincena.',
  'gauge.verdict.current.over':
    'Por encima del límite. Pedí que te saquen turnos antes de que la quincena cierre.',
  'gauge.verdict.future.ok': 'Dentro del límite con el roster actual.',
  'gauge.verdict.future.warning':
    'Al filo con el roster actual. Pensalo dos veces antes de aceptar un extra.',
  'gauge.verdict.future.over':
    'El roster actual te pasa del límite, pero todavía estás a tiempo de pedir que te saquen turnos.',
  'gauge.prev': 'Quincena anterior',
  'gauge.next': 'Quincena siguiente',
  'gauge.backToCurrent': 'volver a la vigente',
  'gauge.of': (p: { limit: number }) => `de ${p.limit} h`,
  'gauge.aria': (p: { hours: number; limit: number; range: string }) =>
    `${p.hours} de ${p.limit} horas en la quincena ${p.range}`,
  'gauge.stat.total': 'Total con breaks',
  'gauge.stat.conservative': 'Escenario duro',
  'gauge.stat.breakDays': 'Días de break',

  // --- Escalera de quincenas ---
  'ladder.empty': 'Sin quincenas para mostrar.',
  'ladder.tooltip': (p: { inSession: number; total: number; breakDays: number }) =>
    `${p.inSession} h en sesión · ${p.total} h totales${p.breakDays ? ` · ${p.breakDays} días de break` : ''}`,

  // --- Plan de recorte ---
  'drop.empty': (p: { limit: number }) =>
    `Ninguna quincena abierta supera las ${p.limit} h. No hay nada que pedir que te saquen.`,
  'drop.eyebrow': 'Recorte sugerido',
  'drop.headline': (p: { shifts: number; hours: number }) =>
    `Soltando ${p.shifts} turno${p.shifts === 1 ? '' : 's'} recuperás ${p.hours} h`,
  'drop.note':
    'Elegidos por orden de impacto: primero los que arreglan más quincenas a la vez. Solo incluye turnos de hoy en adelante, que son los únicos que todavía se pueden mover.',
  'drop.managerMessage': 'Mensaje para el manager',
  'drop.managerNote':
    'Va en inglés a propósito: es para mandárselo tal cual a tu manager.',
  'drop.copy': 'Copiar',
  'drop.copied': 'Copiado',

  // --- Lista de hallazgos ---
  'findings.empty':
    'Sin hallazgos. Ni las quincenas ni los payslips muestran problemas con los datos cargados.',
  'findings.severity.critical': 'Crítico',
  'findings.severity.high': 'Alto',
  'findings.severity.medium': 'Medio',
  'findings.severity.info': 'Nota',
  'findings.category.visa': 'Visa',
  'findings.category.pay': 'Pago',
  'findings.category.km': 'Km',
  'findings.category.data': 'Datos',

  // --- Hallazgos: visa ---
  'f.visa.pastOver.title': (p: { count: number; limit: number }) =>
    `${p.count} quincena(s) ya cerradas por encima de ${p.limit} h`,
  'f.visa.pastOver.detail': (p: { range: string; hours: number; over: number }) =>
    `La peor es ${p.range} con ${p.hours} h (+${p.over} h). Esto ya ocurrió y no se puede corregir con el roster; sirve para saber dónde estás parado si alguna vez te lo preguntan.`,
  'f.visa.over.title': (p: { hours: number; over: number }) =>
    `Quincena abierta en ${p.hours} h (+${p.over} sobre el límite)`,
  'f.visa.over.detail': (p: { range: string }) =>
    `${p.range}: todavía estás a tiempo de pedir que te saquen turnos. Mirá el plan de recorte para ver cuáles.`,
  'f.visa.warn.title': (p: { hours: number; limit: number }) =>
    `Quincena al límite: ${p.hours} h de ${p.limit}`,
  'f.visa.warn.detail': (p: { range: string; margin: number }) =>
    `${p.range}: te quedan ${p.margin} h de margen. Cualquier turno extra te pasa.`,
  'f.visa.conservative.title': (p: { count: number }) =>
    `${p.count} quincena(s) se pasarían si contaran el sleepover entero`,
  'f.visa.conservative.detail': (p: { range: string; hours: number }) =>
    `${p.range} llegaría a ${p.hours} h en la lectura más dura, donde las 8 h de la franja 22:00-06:00 cuentan como trabajo. No es la interpretación que confirman tus payslips, pero conviene tenerlo medido.`,

  // --- Hallazgos: payslip contra roster ---
  'f.sleepover.title': (p: { paid: number; rostered: number }) =>
    `Sleepovers pagados no coinciden (${p.paid} vs ${p.rostered} en el roster)`,
  'f.sleepover.detail': (p: { range: string; rostered: number; paid: number }) =>
    `${p.range}: el roster tiene ${p.rostered} noche(s) con franja 22:00-06:00 ocupada y el payslip liquidó ${p.paid}.`,
  'f.arith.title': 'El payslip no cierra con su propio total',
  'f.arith.detail': (p: { file: string; total: string }) =>
    `${p.file}: la suma de los conceptos no da el Total Earnings declarado (${p.total}). Puede ser un concepto mal cargado.`,
  'f.night.title': (p: { hours: number }) =>
    `${p.hours} h de Night Hours: sleepover interrumpido`,
  'f.night.detail': (p: { range: string }) =>
    `${p.range}: te despertaron durante el sleepover. Esas horas se pagaron a tarifa nocturna y SÍ cuentan para el límite de la visa, aunque la regla general del sleepover las excluya. Sumalas a mano a esa quincena.`,
  'f.missingPayslip.title': 'Faltan payslips de días ya trabajados',
  'f.missingPayslip.detail': (p: { range: string }) =>
    `${p.range}: hay turnos registrados pero ningún payslip que los cubra. Pedilos para poder verificar el pago.`,

  // --- Hallazgos: turno partido ---
  'f.brokenShift.title': (p: { count: number; maxSpan: number }) =>
    `${p.count} días con dos bloques separados por más de ${p.maxSpan} h`,
  'f.brokenShift.detail': (p: { date: string; span: number }) =>
    `El peor caso es el ${p.date} con ${p.span} h de lapso. Con ese lapso no son turnos partidos sino turnos separados, así que el Broken Shift Allowance no corresponde. Si el empleador sostiene que sí lo son, entonces incumple el tope de la cláusula 25.6 y te debe double time por las horas posteriores a la hora 12. Leer la cláusula antes de reclamar.`,

  // --- Hallazgos: km ---
  'f.km.title': (p: { km: number; money: string }) => `${p.km} km sin reembolsar (${p.money})`,
  'f.km.detail': (p: {
    range: string;
    declared: number;
    paidMoney: string;
    paidKm: number;
    rate: number;
    shifts: string;
  }) =>
    `${p.range}: declaraste ${p.declared} km y te pagaron ${p.paidMoney} (${p.paidKm} km a $${p.rate}/km). Turnos con km: ${p.shifts}.`,
  'f.km.noDetail': 'sin detalle',
  'f.km.titleSettled': (p: { km: number; money: string }) =>
    `${p.km} km reintegrados en un payslip posterior (${p.money})`,
  'f.km.settledNote': (p: { km: number; money: string; date: string }) =>
    ` Ya te los reintegraron: ${p.money} (${p.km} km) llegaron en el pago del ${p.date}.`,
  'f.km.partialNote': (p: { km: number; money: string; date: string }) =>
    ` De esos, ${p.money} (${p.km} km) volvieron en el pago del ${p.date}; el resto sigue abierto.`,
  'f.kmLimit.title': (p: { km: number; limit: number }) =>
    `${p.km} km declarados superan el límite de ${p.limit} km`,
  'f.kmLimit.detail': (p: { date: string; limit: number }) =>
    `${p.date}: por encima de ${p.limit} km hace falta aprobación del manager, si no te lo pueden rechazar.`,
  'f.kmVague.title': 'Mencionaste viaje sin anotar los km',
  'f.kmVague.detail': (p: { date: string; comment: string }) =>
    `${p.date}: "${p.comment}". Sin cifra no es reclamable de forma retroactiva; anotá siempre los km.`,

  // --- Hallazgos: liquidación ---
  'f.payDelta.titleShort': (p: { money: string }) =>
    `Te pagaron ${p.money} menos de lo que da el roster`,
  'f.payDelta.titleOver': (p: { money: string }) =>
    `Te pagaron ${p.money} más de lo que da el roster`,
  'f.payDelta.detail': (p: { range: string; expected: string; actual: string }) =>
    `${p.range}: el roster da ${p.expected} de bruto y el payslip liquidó ${p.actual}.`,
  'f.payDelta.overNote':
    ' Casi siempre significa que un turno se pagó pero nunca quedó registrado en Deputy, no que te hayan pagado de más.',
  'f.payDelta.titleSettled': (p: { money: string }) => `Recuperaste ${p.money} de esta semana`,
  'f.payDelta.settledNote': (p: { money: string; date: string }) =>
    ` Ese faltante volvió como Back Pay: ${p.money} cobrados el ${p.date}. Esta semana ya está saldada.`,
  'f.payDelta.titlePartial': (p: { money: string }) =>
    `Todavía faltan ${p.money} después del Back Pay`,
  'f.payDelta.partialNote': (p: { money: string; date: string }) =>
    ` El Back Pay del ${p.date} devolvió ${p.money}, pero no cubrió todo el faltante: el resto sigue sin pagar.`,
  'f.backPay.title': (p: { money: string }) => `${p.money} de Back Pay sin imputar a ninguna semana`,
  'f.backPay.detail': (p: { range: string; amount: string; count: number; lines: string }) =>
    `El payslip de ${p.range} liquidó ${p.amount} de Back Pay y el desglose solo explica ${p.count} semana(s). Sin desglose no se puede saldar la semana que lo reclamaba.${p.lines ? ` Renglones sin leer: ${p.lines}.` : ''}`,
  'f.payLines.title': (p: { count: number }) =>
    `${p.count} concepto(s) liquidados distinto de lo esperado`,
  'f.payLines.item': (p: { label: string; expected: string; actual: string }) =>
    `${p.label}: estimado ${p.expected}, pagado ${p.actual}`,
  'f.payLines.hoursNote': (p: { expected: number; actual: number }) =>
    ` Horas: el roster da ${p.expected} y el payslip pagó ${p.actual}.`,
  'f.payLines.detail': (p: { range: string; differences: string; hoursNote: string }) =>
    `${p.range} — ${p.differences}.${p.hoursNote}`,
  'f.holidayMissing.title': 'El payslip pagó un feriado que no está en el calendario local',
  'f.holidayMissing.detail': (p: { range: string; hours: number; dates: string }) =>
    `${p.range}: se liquidaron ${p.hours} h como Public Holiday pero ningún turno de esa semana cae en una fecha de \`data/holidays.json\`. Días trabajados: ${p.dates}. Agregar el que corresponda.`,
  'f.taxDrift.title': (p: { count: number }) =>
    `La fórmula de retención no reproduce ${p.count} payslip(s)`,
  'f.taxDrift.sample': (p: { date: string; gross: string; expected: string; actual: string }) =>
    `${p.date}: bruto ${p.gross}, fórmula ${p.expected}, retenido ${p.actual}`,
  'f.taxDrift.detail': (p: { samples: string }) =>
    `La tabla de la ATO cargada en la app dejó de coincidir con lo que retiene la nómina. Puede ser un cambio de escala (préstamo de estudio, residencia fiscal) o una tabla nueva. Hasta resolverlo, el impuesto estimado es orientativo. ${p.samples}.`,
  'f.superDrift.title': (p: { count: number; rate: string }) =>
    `El aporte jubilatorio no da el ${p.rate} en ${p.count} payslip(s)`,
  'f.superDrift.sample': (p: { date: string; expected: string; actual: string }) =>
    `${p.date}: esperado ${p.expected}, aportado ${p.actual}`,
  'f.superDrift.detail': (p: { samples: string }) =>
    `Base = Total Earnings menos overtime. ${p.samples}.`,
  'f.taxTable.title': 'La tabla de retención vigente es de un año fiscal anterior',
  'f.taxTable.detail': (p: { date: string }) =>
    `El pago del ${p.date} cae en un año fiscal para el que la app todavía no tiene coeficientes. Se está usando la tabla más nueva disponible, así que el impuesto estimado puede estar corrido. Actualizar \`shared/pay/tax.ts\` con la NAT 1004 del año en curso.`,

  // --- Recibo del pago ---
  'pay.empty': 'Todavía no hay turnos para estimar un pago. Sincronizá con Deputy.',
  'pay.basis.payslip': 'liquidado',
  'pay.basis.timesheet': 'horas fichadas',
  'pay.basis.roster': 'roster publicado',
  'pay.basis.mixed': 'fichado + roster',
  'pay.basis.empty': 'sin turnos',
  'pay.basisNote.payslip': 'El payslip ya llegó: esta fila muestra lo que realmente entró.',
  'pay.basisNote.timesheet':
    'Las horas ya están fichadas en Deputy, así que el número es firme salvo que el empleador liquide distinto.',
  'pay.basisNote.roster':
    'Sale del roster publicado. Si te cambian un turno, cambia el número.',
  'pay.basisNote.mixed': 'Parte de la semana ya está fichada y parte sigue siendo roster.',
  'pay.basisNote.empty': 'No hay turnos cargados para esta semana.',
  'pay.headline.empty': 'Esa semana no tenés turnos cargados',
  'pay.headline.actual': 'Esto es lo que entró',
  'pay.headline.roster': 'Esto es lo que entraría si el roster no cambia',
  'pay.headline.mixed': 'Esto es lo que va entrando',
  'pay.headline.forecast': 'Esto es lo que va a entrar',
  'pay.depositedOn': (p: { date: string }) => `Se depositó el ${p.date}`,
  'pay.depositsOn': (p: { date: string }) => `Se deposita el ${p.date}`,
  'pay.toAccount': 'a tu cuenta',
  'pay.legend.net': (p: { money: string }) => `neto ${p.money}`,
  'pay.legend.tax': (p: { money: string }) => `impuesto ${p.money}`,
  'pay.barAria': (p: { gross: string; net: string; tax: string }) =>
    `De ${p.gross} de bruto, ${p.net} quedan netos y ${p.tax} van a impuesto`,
  'pay.range': (p: { range: string; paidHours: number; visaHours: number }) =>
    `Semana ${p.range} · ${p.paidHours} h pagadas · ${p.visaHours} h para la visa`,
  'pay.stat.gross': 'Bruto',
  'pay.stat.tax': (p: { year: string }) => `Impuesto (${p.year})`,
  'pay.stat.super': 'Súper (al fondo)',
  'pay.stat.reimbursements': 'Viáticos',
  'pay.caption.actual': 'Lo que el roster dice que deberían pagarte',
  'pay.caption.forecast': 'Concepto por concepto',
  'pay.delta': (p: {
    expected: string;
    actual: string;
    missing: boolean;
    amount: string;
  }) =>
    `El roster daba ${p.expected} de bruto y el payslip liquidó ${p.actual}: ${p.missing ? 'faltan' : 'sobran'} ${p.amount}.`,

  // --- Tabla semana a semana ---
  'pay.weeks.empty': 'No hay semanas para mostrar.',
  'pay.col.week': 'Semana',
  'pay.col.payment': 'Pago',
  'pay.col.basis': 'Base',
  'pay.col.hours': 'Horas',
  'pay.col.gross': 'Bruto',
  'pay.col.tax': 'Impuesto',
  'pay.col.super': 'Súper',
  'pay.col.bank': 'Al banco',
  'pay.col.delta': 'vs payslip',
  'pay.col.deltaTitle':
    'Bruto del payslip contra bruto del roster. En rojo lo que falta, en ámbar lo que sobra.',
  'pay.closes': 'cierra',
  'pay.settled': 'saldada',
  'pay.settledTitle': (p: { money: string; date: string }) =>
    `Faltaban ${p.money} y volvieron como Back Pay el ${p.date}.`,
  'pay.partialTitle': (p: { money: string; date: string }) =>
    `El Back Pay del ${p.date} devolvió ${p.money}; esto es lo que sigue faltando.`,
  'pay.total': (p: { count: number }) => `Total (${p.count} semanas)`,

  // --- Resumen del reclamo (Back Pay) ---
  'backPay.eyebrow': 'Back Pay',
  'backPay.recovered': (p: { money: string; date: string }) =>
    `Ya te devolvieron ${p.money} el ${p.date}`,
  'backPay.weeks': (p: { count: number }) =>
    `repartidos en ${p.count} semana${p.count === 1 ? '' : 's'} viejas, según los comentarios del payslip`,
  'backPay.open': (p: { money: string; count: number }) =>
    `Todavía faltan ${p.money} en ${p.count} semana${p.count === 1 ? '' : 's'}`,
  'backPay.clear': 'No queda ninguna semana corta sin cobrar',

  // --- Tabla de payslips ---
  'payslips.empty':
    'No se leyó ningún payslip. Revisá que PAYSLIPS_DIR apunte a la carpeta correcta.',
  'payslips.col.period': 'Período',
  'payslips.col.hours': 'Horas',
  'payslips.col.sleepovers': 'Sleepovers',
  'payslips.col.nightHours': 'Night h',
  'payslips.col.travel': 'Viáticos',
  'payslips.col.gross': 'Bruto',
  'payslips.col.net': 'Neto',
  'payslips.col.status': 'Estado',
  'payslips.total': (p: { count: number }) => `Total (${p.count})`,
  'payslips.ok': 'ok',
  'payslips.mismatch': 'no cierra',
  'payslips.backPay': (p: { money: string }) => `back pay ${p.money}`,
  'payslips.backPayTitle': (p: { count: number; weeks: string }) =>
    `Reintegro de ${p.count} semana(s) anteriores: ${p.weeks}. No es plata de esta semana.`,

  // --- Reportes de turno ---
  'section.reports.title': 'Reportes de turno',
  'section.reports.note': (p: { client: string; from: string; pending: number }) =>
    `Turnos completados con ${p.client} desde el ${p.from} · ${p.pending} sin redactar`,
  'reports.empty': (p: { client: string }) =>
    `No hay turnos completados con ${p.client} en el rango. Sincronizá con Deputy si falta alguno.`,
  'reports.noApiKey':
    'Falta ANTHROPIC_API_KEY en el .env: podés anotar y guardar, pero no redactar.',
  'form.map': 'Mapear al formulario',
  'form.mapping': 'Mapeando…',
  'form.mapHint':
    'Lee la nota de Deputy y la vuelca en las 25 preguntas del formulario, marcando lo que falta.',
  'form.manualEntry': 'Carga manual (conductas, presentación, apoyos)',
  'form.generate': 'Generar formulario',
  'form.generating': 'Generando…',
  'form.bookmarklet': 'Copiar marcador para llenar',
  'form.bookmarkletCopied': 'Copiado · pegá en un marcador nuevo',
  'form.bookmarkletHelp':
    'Pegálo como URL de un marcador nuevo. Después abrí el formulario y tocá el marcador: se llenan las preguntas y el Submit lo apretás vos. Lleva las respuestas de este turno adentro, así que volvé a copiarlo si regenerás.',
  'form.openForm': 'Abrir formulario ↗',
  'form.step.copy': 'Copiá el marcador (la primera vez, guardalo en la barra de marcadores).',
  'form.step.open': 'Abrí el formulario en otra pestaña.',
  'form.step.click': 'Tocá el marcador ahí: se llenan las preguntas. Revisás y apretás Submit vos.',
  'form.output': 'Formulario listo para pegar',
  'form.review.title': 'Revisión del formulario',
  'form.review.count': (p: { open: number; required: number }) =>
    p.open === 0
      ? `sin preguntas pendientes · ${p.required} obligatorias sin completar`
      : `${p.open} para confirmar · ${p.required} obligatorias sin completar`,
  'form.review.documented': 'Documentado en la fuente',
  'form.review.confirmed': 'Confirmado por vos',
  'form.review.needed': 'Requiere confirmación',
  'form.review.unavailable': 'No se puede determinar',
  'form.review.shortAnswer': 'Respuesta corta',
  'form.review.foot':
    'Solo lo documentado y lo confirmado entra al formulario. Lo pendiente queda afuera.',
  'form.unverified': (p: { fields: string }) =>
    `Opciones sin cotejar contra el formulario real: ${p.fields}. Se corrigen en shared/form/schema.ts`,
  'reports.expand': 'Ver',
  'reports.collapse': 'Plegar',
  'reports.foldedSummary': (p: { answers: number; when: string }) =>
    `${p.answers} respuestas · generado ${p.when}`,
  'reports.tab.pending': (p: { count: number }) => `Pendientes (${p.count})`,
  'reports.tab.archived': (p: { count: number }) => `Archivados (${p.count})`,
  'reports.emptyArchived':
    'Todavía no archivaste ninguno. Un turno pasa acá cuando lo marcás como cargado.',
  'reports.checkNew': 'Buscar turnos nuevos',
  'reports.checking': 'Buscando…',
  'reports.foundNew': (p: { count: number }) =>
    p.count === 1 ? '1 turno nuevo para reportar' : `${p.count} turnos nuevos para reportar`,
  'reports.noNew': 'Sin turnos nuevos.',
  'reports.status.pending': 'sin redactar',
  'reports.status.drafted': 'redactado',
  'reports.status.submitted': 'cargado',
  'reports.behaviours': 'Conductas observadas',
  'reports.behavioursNote':
    'Tildá solo lo que viste, con la cantidad real. El texto se redacta con estos números.',
  'reports.unit.times': 'veces',
  'reports.unit.minutes': 'minutos',
  'reports.notePlaceholder': 'Qué pasó, en tus palabras',
  'reports.presentationNote':
    'Tocá lo que corresponda. Con esto solo ya alcanza para redactar el turno.',
  'reports.presentation.freeText': 'Algo más que no entre arriba',
  'reports.group.mood': 'Ánimo',
  'reports.group.sleep': 'Sueño',
  'reports.group.appetite': 'Apetito',
  'reports.group.engagement': 'Participación',
  'reports.moreDetail': 'detalle',
  'reports.lessDetail': 'ocultar',
  'reports.presentation.label': 'Cómo se presentó',
  'reports.presentation.placeholder':
    'Ánimo, sueño, apetito, participación. Un turno tranquilo también se describe acá.',
  'reports.support.label': 'Apoyos que brindaste',
  'reports.support.placeholder': 'Qué hiciste y cómo respondió.',
  'reports.deputyComment': 'Comentario en Deputy',
  'reports.noDeputyComment': 'Sin comentario en Deputy para este turno.',
  'reports.save': 'Guardar',
  'reports.saving': 'Guardando…',
  'reports.saved': 'Guardado',
  'reports.draftedAt': (p: { when: string }) => `Redactado ${p.when}`,
  'reports.copy': 'Copiar',
  'reports.copied': 'Copiado',
  'reports.markSubmitted': 'Marcar como cargado',
  'reports.unmarkSubmitted': 'Volver a pendiente',
  'reports.openForm': 'Abrir formulario',
  'reports.needMaterial':
    'Marcá al menos una conducta o escribí cómo se presentó antes de redactar.',

  // --- Mensajes del servidor ---
  'server.sync.rangeInvalid': 'El rango es inválido: "from" es posterior a "to".',
  'server.sync.noEmployeeId':
    'No se pudo determinar tu employeeId. Configuralo a mano en DEPUTY_EMPLOYEE_ID dentro del .env.',
  'server.sync.rosterWarning': (p: { reason: string }) =>
    `No se pudieron leer los turnos publicados: ${p.reason}`,
  'server.auth.missingCredentials':
    'Faltan DEPUTY_CLIENT_ID y DEPUTY_CLIENT_SECRET en el .env. Registrá el cliente OAuth en https://once.deputy.com/my/oauth/list',
  'server.payslips.empty': 'No llegó ningún archivo.',
  'server.payslips.notPdf': 'El archivo no es un PDF.',
  'server.termBreaks.notAList': 'Se esperaba una lista de periodos.',
  'server.reports.nothingToFinalise':
    'Todavía no hay nada mapeado al formulario. Corré "Mapear al formulario" primero.',
  'server.reports.unknownShift':
    'Ese turno no está entre los que llevan reporte. Sincronizá con Deputy y volvé a intentar.',
  'server.termBreaks.badDates':
    'Cada periodo necesita "start" y "end" en formato YYYY-MM-DD.',
};

/** Forma del catalogo. `en.ts` se tipa contra esto. */
export type Messages = typeof es;
