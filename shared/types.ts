/** Tipos compartidos entre el servidor y la UI. */

/** Fecha en formato YYYY-MM-DD (hora local de Queensland, sin DST). */
export type IsoDate = string;

/** Origen del turno: un timesheet ya trabajado o un roster publicado a futuro. */
export type ShiftSource = 'timesheet' | 'roster';

export interface Shift {
  readonly id: string;
  readonly source: ShiftSource;
  /** Dia de reloj en que arranca el turno. */
  readonly date: IsoDate;
  /** Inicio en minutos desde la medianoche del dia `date`. */
  readonly startMinute: number;
  /** Fin en minutos desde la medianoche del dia `date`. Puede superar 1440 si cruza medianoche. */
  readonly endMinute: number;
  readonly area: string | null;
  readonly employeeComment: string | null;
  readonly approved: boolean;
  /** Km declarados por el trabajador en el comentario del timesheet. */
  readonly kmDeclared: number | null;
}

/** Horas computables para la visa, imputadas a un dia de reloj concreto. */
export interface DailyHours {
  readonly date: IsoDate;
  /** Horas del turno fuera de la franja 22:00-06:00. */
  readonly countable: number;
  /** Horas brutas de presencia, incluida la franja nocturna. */
  readonly gross: number;
  /** Cantidad de franjas nocturnas 22:00-06:00 cubiertas (sleepovers). */
  readonly sleepovers: number;
  readonly shiftIds: readonly string[];
}

export interface Fortnight {
  readonly start: IsoDate;
  readonly end: IsoDate;
  /** Horas computables sumando los 14 dias. */
  readonly total: number;
  /** Horas computables excluyendo los dias de term break (las que miran en Home Affairs). */
  readonly inSession: number;
  /** Escenario conservador: como `inSession` pero contando el sleepover completo. */
  readonly conservative: number;
  readonly breakDays: number;
  readonly overBy: number;
  readonly status: 'ok' | 'warning' | 'over';
}

export type PayslipLineKind = 'hours' | 'allowance' | 'reimbursement' | 'backpay' | 'other';

/** Tramo de un Back Pay imputado a la semana que lo genero. */
export interface BackPayAllocation {
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly hours: number;
  readonly amount: number;
}

/** Back Pay liquidado en un payslip: plata de semanas anteriores. */
export interface BackPay {
  /** Importe de la linea `Back Pay`, tal cual lo liquido el payslip. */
  readonly amount: number;
  /** Desglose por semana, leido del bloque MESSAGES. */
  readonly allocations: readonly BackPayAllocation[];
  /** Parte del importe que el desglose no explica. Deberia ser 0. */
  readonly unallocated: number;
  /** Renglones del desglose que el parser no supo leer. */
  readonly unreadable: readonly string[];
}

export interface PayslipLine {
  readonly label: string;
  readonly kind: PayslipLineKind;
  readonly quantity: number | null;
  readonly rate: number | null;
  readonly amount: number;
}

export interface Payslip {
  readonly file: string;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly paymentDate: IsoDate | null;
  readonly totalEarnings: number;
  readonly netPay: number;
  readonly lines: readonly PayslipLine[];
  /** Horas pagadas sumando todas las lineas de tipo `hours`. */
  readonly paidHours: number;
  /** Cantidad de sleepovers liquidados. Muchos payslips no imprimen la cantidad,
   *  asi que se deduce dividiendo el importe por la tarifa unitaria. */
  readonly sleepoverCount: number;
  readonly sleepoverAmount: number;
  readonly travelCostsPaid: number;
  /** Horas pagadas como `Night Hours`: sleepover interrumpido, cuentan para la visa. */
  readonly nightHours: number;
  /** Retencion PAYG del periodo. */
  readonly taxWithheld: number;
  /** Aporte jubilatorio (SGC) del periodo. No entra en el neto: va al fondo. */
  readonly superannuation: number;
  /** Lo que efectivamente entro al banco: neto mas reembolsos. Los viaticos van
   *  fuera de Total Earnings, asi que no estan en `netPay`. */
  readonly bankPayment: number;
  /** Back Pay liquidado aca por semanas anteriores, con su desglose. */
  readonly backPay: BackPay | null;
  /** true si la suma de las lineas no coincide con el total declarado. */
  readonly arithmeticMismatch: boolean;
}

/** Categorias en que se liquida una hora trabajada. */
export type PayCategory =
  | 'ordinary'
  | 'evening'
  | 'saturday'
  | 'sunday'
  | 'holiday'
  | 'overtime'
  | 'night';

/** Tarifas vigentes en una fecha, leidas de los payslips. */
export interface RateCard {
  /** Inicio del periodo del payslip del que salieron estas tarifas. */
  readonly effectiveFrom: IsoDate;
  readonly hourly: Readonly<Record<PayCategory, number>>;
  /** Importe por noche de sleepover. */
  readonly sleepover: number;
  /** Importe por dia con turno partido. */
  readonly brokenShift: number;
  /** Importe por hora trabajada, por tener certificado de primeros auxilios. */
  readonly firstAid: number;
}

/** De donde salen los turnos de una semana pronosticada. */
export type ForecastBasis = 'payslip' | 'timesheet' | 'roster' | 'mixed' | 'empty';

export interface ForecastLine {
  readonly label: string;
  readonly kind: PayslipLineKind;
  readonly quantity: number | null;
  readonly rate: number | null;
  readonly amount: number;
}

/** Estimacion de una semana de pago. */
export interface PayForecast {
  readonly weekStart: IsoDate;
  readonly weekEnd: IsoDate;
  readonly paymentDate: IsoDate;
  readonly basis: ForecastBasis;
  readonly lines: readonly ForecastLine[];
  readonly paidHours: number;
  /** Horas que cuentan para la condicion 8105 en esta semana. */
  readonly visaHours: number;
  /** Total Earnings estimado: sin viaticos, que van aparte. */
  readonly gross: number;
  readonly tax: number;
  /** Bruto menos retencion. */
  readonly net: number;
  readonly reimbursements: number;
  /** Lo que se deposita: neto mas viaticos. */
  readonly bankPayment: number;
  readonly superannuation: number;
  /** El payslip real de esa semana, si ya llego. */
  readonly actual: {
    readonly gross: number;
    readonly tax: number;
    readonly net: number;
    readonly superannuation: number;
    readonly bankPayment: number;
    readonly paidHours: number;
  } | null;
  /** Estimado menos pagado, ya descontado el Back Pay que el payslip liquido por
   *  semanas anteriores: esa plata no es de esta semana. Solo cuando hay payslip. */
  readonly grossDelta: number | null;
  /** Como quedo esta semana frente a lo que se cobro, contando reintegros. */
  readonly settlement: Settlement;
}

/** Estado de una semana frente a su payslip.
 *
 *  - `pending`   todavia no llego el payslip
 *  - `matches`   el payslip pago lo que el roster decia
 *  - `short`     falto plata y sigue faltando
 *  - `partial`   llego un Back Pay pero no alcanzo a cubrir el faltante
 *  - `settled`   el faltante se reintegro entero en un Back Pay posterior
 *  - `over`      el payslip pago de mas */
export type SettlementStatus = 'pending' | 'matches' | 'short' | 'partial' | 'settled' | 'over';

export interface Settlement {
  readonly status: SettlementStatus;
  /** Plata de esta semana reintegrada despues, via Back Pay. */
  readonly recovered: number;
  /** Faltante que sigue abierto: `grossDelta` menos `recovered`. */
  readonly outstanding: number;
  /** Payslip que pago el reintegro, si hubo. */
  readonly recoveredIn: {
    readonly periodStart: IsoDate;
    readonly paymentDate: IsoDate;
  } | null;
  /** Back Pay que el payslip de **esta** semana liquido por semanas anteriores.
   *  No es plata de esta semana: se descuenta antes de comparar. */
  readonly carried: number;
}

/** Como va el reclamo en conjunto: cuanta plata volvio ya como Back Pay y
 *  cuanta sigue sin pagar, sumando todas las semanas.
 *
 *  Semana por semana la respuesta ya esta (cada fila dice si esta saldada), pero
 *  la pregunta que uno se hace al abrir un payslip nuevo es la del total: de todo
 *  lo que reclamaba, que me pagaron y que falta. */
export interface BackPayRollup {
  /** Total reintegrado via Back Pay, imputado a las semanas que lo generaron. */
  readonly recovered: number;
  /** Semanas que recibieron algo. */
  readonly weeksRecovered: number;
  /** Faltante que sigue abierto en total, contando tambien las semanas que
   *  todavia no se reclamaron. */
  readonly outstanding: number;
  readonly weeksOpen: number;
  /** Deposito mas reciente que trajo un reintegro, o null si nunca volvio nada. */
  readonly lastPaymentDate: IsoDate | null;
}

export interface PaySummary {
  /** La semana del proximo deposito: la primera cuyo pago aun no ocurrio. */
  readonly next: PayForecast | null;
  /** Semanas alrededor de hoy, de la mas vieja a la mas nueva. */
  readonly weeks: readonly PayForecast[];
  readonly rates: RateCard;
  /** Año fiscal de la tabla de retencion aplicada al proximo pago. */
  readonly taxYear: string;
  /** Estado del reclamo: cuanto volvio y cuanto sigue abierto. */
  readonly backPay: BackPayRollup;
  /** Acumulado del año fiscal en curso, sumando payslips reales. */
  readonly yearToDate: {
    readonly financialYear: string;
    readonly gross: number;
    readonly tax: number;
    readonly superannuation: number;
    readonly bankPayment: number;
    readonly payslips: number;
  };
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface Finding {
  readonly id: string;
  readonly severity: FindingSeverity;
  readonly category: 'visa' | 'pay' | 'km' | 'data';
  readonly title: string;
  readonly detail: string;
  /** Plata en juego, si aplica. */
  readonly amount: number | null;
  readonly date: IsoDate | null;
}

/** Turno candidato a soltar para volver por debajo del limite.
 *
 *  Guarda las partes sueltas en vez de una etiqueta ya armada porque tiene dos
 *  lectores con idiomas distintos: el panel, que sigue el idioma elegido, y el
 *  mensaje para el manager, que va siempre en ingles. */
export interface DropSuggestion {
  readonly shiftId: string;
  readonly date: IsoDate;
  /** `06:00-09:00`. */
  readonly time: string;
  readonly area: string | null;
  /** Horas computables que libera. */
  readonly hoursFreed: number;
  /** Quincenas que deja de exceder. */
  readonly fixesFortnights: readonly string[];
}

export interface AnalysisReport {
  readonly generatedAt: string;
  readonly limit: number;
  readonly daily: readonly DailyHours[];
  readonly fortnights: readonly Fortnight[];
  readonly current: Fortnight | null;
  readonly upcoming: readonly Fortnight[];
  readonly payslips: readonly Payslip[];
  readonly findings: readonly Finding[];
  readonly dropPlan: readonly DropSuggestion[];
  readonly pay: PaySummary;
  readonly totals: {
    readonly rosterHours: number;
    readonly paidHours: number;
    readonly grossPaid: number;
    readonly netPaid: number;
    readonly kmOwed: number;
    readonly moneyOwed: number;
    /** Bruto que el roster dice que falta en payslips ya emitidos y que todavia
     *  no se reintegro. Lo ya saldado por Back Pay no cuenta. */
    readonly payShortfall: number;
    /** Bruto ya reclamado y reintegrado via Back Pay. */
    readonly payRecovered: number;
  };
}
