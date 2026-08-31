# Horas

Herramienta interna local para tres cosas:

1. **Control de la condición 8105** — cuántas horas computables llevás en cada ventana
   quincenal, cuáles se pasan de 48 h y qué turnos concretos conviene pedir que te saquen.
2. **Pronóstico de pago** — cuánto vas a cobrar el jueves, cuánto se lleva la ATO y cuánto
   va a tu fondo de jubilación, calculado a partir del roster antes de que llegue el payslip.
3. **Auditoría de pagos** — cruza esa misma estimación contra los payslips en PDF y marca
   horas mal pagadas, sleepovers faltantes, km sin reembolsar y payslips que no cierran.

Corre entera en tu máquina. No sube nada a ningún lado. Está en **español e inglés**.

## Puesta en marcha

```bash
cd app
npm install
cp .env.example .env       # y completar (ver abajo)
npm run db:migrate         # solo la primera vez: importa data/*.json a Supabase
npm run payslips:import    # parsea los PDF y los guarda en Supabase
npm run dev                # API en :8787, front en :5173
```

Abrí <http://localhost:5173>.

### Base de datos

Los datos viven en Supabase (Postgres), no en archivos. Para crear el proyecto:

1. Entrá a <https://supabase.com>, **New project**. Elegí la región más cercana
   (`Southeast Asia (Singapore)` o `Australia (Sydney)` si está disponible).
2. En **Project Settings → API** copiá la *Project URL* y la **`service_role`** key al
   `.env`. La `anon` key no sirve acá: todas las tablas tienen RLS habilitada y sin
   políticas, así que sólo entra el servidor.
3. En **SQL Editor** pegá y corré `supabase/migrations/0001_init.sql`.
4. `npm run db:migrate` importa lo que haya en `data/*.json`. Es idempotente: todo se
   escribe con upsert sobre la clave natural, así que se puede correr de nuevo sin
   duplicar nada.

No hay login todavía: el servidor sigue escuchando sólo en `127.0.0.1` y esa es la única
puerta. La base está en la nube, la app no.

### Credenciales de Deputy

1. Entrá a <https://once.deputy.com/my/oauth/list> y creá un cliente OAuth.
2. Registrá como redirect URI exactamente: `http://localhost:8787/api/auth/callback`
3. Copiá `Client Id` y `Client Secret` al `.env`.

Si esa página te da permiso denegado, el install es del empleador y hace falta un
System Administrator para registrar el cliente. En ese caso queda pendiente la vía
alternativa (login real en navegador controlado, capturando la sesión).

El login ocurre en la página de Deputy: la app nunca ve tu contraseña. El access token
dura 24 h y se renueva solo con el refresh token, que rota en cada uso.

### Variables

| Variable | Para qué |
|---|---|
| `DEPUTY_CLIENT_ID` / `DEPUTY_CLIENT_SECRET` | Cliente OAuth |
| `DEPUTY_INSTALL_URL` | Install del empleador; Deputy puede sobrescribirlo al autorizar |
| `DEPUTY_EMPLOYEE_ID` | Opcional: si falta se resuelve vía `/api/v1/me` (con fallback a `/api/me/v2`) |
| `VISA_FORTNIGHT_LIMIT` | 48 por defecto |
| `KM_RATE` | 0.99, deducido de tus payslips |
| `PAYSLIPS_DIR` | Carpeta de los PDF, por defecto `../payslips` |

### Endpoints de Deputy que usa el sync

| Qué | Endpoint | Nota |
|---|---|---|
| Identidad | `/api/v1/me` | Fallback a `/api/me/v2`, que usa la web de Deputy |
| Turnos trabajados | `POST /api/v1/resource/Timesheet/QUERY` | Filtra por `Employee` + rango de `Date`, paginado de a 500 |
| Turnos publicados | `/api/v1/my/roster` | El recurso `Roster` está denegado para tokens de empleado (`Access to object-type denied`); este no acepta filtros, así que el rango se recorta en código |

Del lote de timesheets se descartan los `IsLeave` (licencias) y los `Discarded`: no son
horas trabajadas y contarlas inflaría la quincena.

El `endpoint` que Deputy devuelve al canjear el token viene como host pelado, sin
`https://`. Se normaliza al guardarlo y al leerlo.

## Idiomas

El selector está arriba a la derecha. La elección se guarda en `localStorage`; la primera
vez sale del idioma del navegador, con español por defecto.

Los catálogos viven en `shared/i18n/`. **`es.ts` es la fuente de las claves** y `en.ts` se
tipa contra él: si falta una entrada o un parámetro cambia de forma, no compila. Un test
además chequea que ninguna entrada quede vacía y que no haya textos sin traducir, con una
lista explícita de las que legítimamente se escriben igual en los dos idiomas.

Dos cosas **no** siguen al selector, a propósito:

- **El mensaje para el manager va siempre en inglés**, fechas incluidas: se manda tal cual
  a un manager australiano.
- **Las etiquetas de los conceptos del payslip** (`Ordinary Hours`, `Sleepover Allowance`,
  `Broken Shift Allowance`) quedan como las imprime el PDF. Traducirlas haría que el
  desglose no coincidiera con el payslip que tenés al lado, que es justo lo que hay que
  poder comparar. Los importes, por lo mismo, van siempre en formato australiano.

Los hallazgos se redactan **en el servidor**: son prosa con interpolaciones y mantenerlos
como claves más parámetros hasta la UI costaría más de lo que rinde. Por eso cada llamada
al API lleva `?locale=` y cambiar de idioma vuelve a pedir el reporte.

Al agregar un idioma alcanza con sumarlo a `Locale`, escribir su catálogo y agregar los
nombres de día y mes en `shared/i18n/index.ts`.

## Cómo cuenta las horas

Regla verificada contra 35 payslips: **horas computables = duración del turno menos el
solapamiento con la franja 22:00–06:00**, imputadas al día de reloj real.

- `20:00–06:00` → 2 h
- `20:00–08:00` → 2 h el primer día + 2 h el siguiente
- `06:00–09:00` → 3 h

Las horas dentro de la franja se pagan como *Sleepover Allowance*, sin horas asociadas.

**La excepción importante:** si te despiertan durante el sleepover, esas horas se liquidan
como `Night Hours` y **sí cuentan** para la visa. La app las busca en cada payslip y las
marca como hallazgo crítico. A la fecha aparecen una sola vez: 2 h en la semana del 19 feb.

Las ventanas quincenales no son de calendario fijo: Home Affairs mira *cualquier* período
de 14 días que empiece un lunes, así que se generan ventanas deslizantes con paso semanal.
Durante los term breaks no hay tope, y esos días se descuentan del conteo "en sesión".
El calendario académico vive en la tabla `term_breaks` y se puede editar desde la app.

## Cómo estima lo que vas a cobrar

El ciclo de pago va de **jueves a miércoles** y se deposita el **jueves siguiente**. La app
reconstruye la liquidación de cada semana con la misma estructura que el payslip real, así
se pueden poner lado a lado.

### Cómo clasifica cada hora

Reglas deducidas comparando el roster contra 35 semanas liquidadas. Las dos que no son
obvias:

- **La categoría la fija el día en que el turno empieza**, no el día de reloj de cada hora.
  Un turno del viernes 16:00 al sábado 09:00 se paga entero como viernes: las 3 h del
  sábado a la mañana salieron como `Ordinary Hours`, no como `Saturday Hours`.
  Ojo: para la visa la imputación es la contraria, por día de reloj real. Son dos cuentas
  distintas que conviven y no hay que mezclar.
- **La franja 22:00–06:00 no genera horas**: se paga como sleepover.

El resto: domingo, sábado y feriado se llevan el turno entero; en día hábil las horas
posteriores a las 20:00 van como `Evening Hours` y el resto como `Ordinary Hours`.
Pasadas **10 h pagables seguidas**, el excedente se liquida como overtime a 1.5× la tarifa
de la categoría del turno.

**Las tarifas no están hardcodeadas**: salen de tus propios payslips. Cada payslip aporta las
que trae y arrastra las que no, así que cuando el award sube un 1 de julio la app se entera
sola. Lo mismo con el importe del sleepover, el turno partido y el adicional de primeros
auxilios.

### Impuesto y jubilación

- **PAYG**: fórmula NAT 1004 de la ATO, escala 2 (residente que declaró el umbral libre de
  impuestos, sin préstamo de estudio). El año fiscal se elige por la **fecha de pago**, no
  por el período trabajado. Reproduce exacto los 35 payslips: los 30 del año fiscal 2025-26
  y los 5 del 2026-27, donde la tasa mínima bajó de 16% a 15%.
- **Jubilación**: 12% del Total Earnings, descontando el overtime, que está exento. Exacto
  en los 35. No pasa por el neto: va directo al fondo.
- **Viáticos**: quedan fuera del Total Earnings, así que no se gravan ni generan aporte,
  pero se suman a lo que entra al banco. El `Net Pay` que imprime el payslip **no** los
  incluye; el depósito real sí.

Los coeficientes de la ATO están en `shared/pay/tax.ts` y hay que actualizarlos cada 1 de
julio. Si no se hace, la app avisa con el hallazgo `tax-table-missing`. Y si la fórmula deja
de reproducir un payslip real, avisa con `tax-model-drift` en vez de seguir dando un número
equivocado en silencio.

### Feriados

Viven en la tabla `holidays` y se editan a mano a propósito: los regionales —el Toowoomba
Show Day, sin ir más lejos— cambian de fecha todos los años y no hay forma de calcularlos.
Las fechas marcadas `"confirmed": true` están corroboradas contra un payslip. **Falta el
Toowoomba Show Day de 2027.** Cuando se liquida un feriado en una fecha que no está en el
archivo, el hallazgo `holiday-missing` dice cuál agregar.

### Qué tan firme es cada número

| Base | Qué significa |
|---|---|
| `liquidado` | Ya hay payslip: la fila muestra lo que realmente entró |
| `horas fichadas` | Las horas ya están en Deputy; el número es firme salvo que liquiden distinto |
| `roster publicado` | Sale del roster; si te cambian un turno, cambia el número |

Lo único que no se puede pronosticar son las `Night Hours` —dependen de si te despiertan
durante el sleepover—. Cuando el payslip ya llegó se toman de ahí como dato, para que la
semana no aparezca corta por una razón que no es del empleador.

### Precisión medida

`npm run forecast:check` corre la estimación contra todos los payslips:

- **PAYG: 35/35 exacto.** **Jubilación: 35/35 exacto.**
- **Bruto: 23/35 exacto.** Las 12 diferencias no son fallas de la regla: cada una se
  descompone en un concepto concreto y explicable. Siete son plata que falta (unos $560 en
  total, de los cuales $348.36 ya volvieron como Back Pay — ver más abajo) y cinco son
  semanas donde el payslip pagó turnos que nunca quedaron registrados en Deputy.

## Cómo lee los payslips

Los PDF se parsean con `pdfjs-dist` reconstruyendo las filas por coordenada vertical,
porque un volcado de texto plano corre los importes de renglón. Dentro de cada fila:

- `1.0000` (sin símbolo, 4 decimales) → cantidad
- `$21.8100` (con símbolo, 4 decimales) → tarifa
- `$21.81` (con símbolo, 2 decimales) → importe; la columna se decide por posición
  horizontal, para no confundir el acumulado YTD con el pago del período

Después valida dos invariantes: `cantidad × tarifa = importe` en cada línea y
`suma de líneas = Total Earnings`. Los 35 payslips actuales cierran exacto.

Una línea cuenta como horas trabajadas si tiene cantidad y tarifa y no es un adicional
ni una licencia. Esto es deliberado: los feriados se liquidan como `Public Holiday`, sin
la palabra "Hours", y son horas realmente trabajadas.

### Back Pay: así vuelve un reclamo aceptado

El empleador no reemite el payslip viejo. Mete una línea `Back Pay` en el payslip de la
semana en curso y explica al pie, en el bloque `MESSAGES`, a qué semanas corresponde:

```
MESSAGES
Back pay is broken down as below:
12th to 18th February 2026 4 hours $131.52
6th to 12 August 2026 2 hours $68.88
```

Ese bloque es lo que la app lee para no imputar la plata a la semana equivocada. Tomado
literal, un payslip con Back Pay desordena dos semanas a la vez: la que **cobra** aparece
pagada de más y la que **reclamaba** sigue apareciendo corta aunque ya se saldó.

El parseo es tolerante a propósito, porque el formato no es regular: el ordinal del día de
cierre puede faltar (`6th to 12 August`), el mes y el año se escriben una sola vez al final,
un tramo puede cruzar el año nuevo y el bloque puede continuar en una segunda página sin
encabezado. Lo que no se pueda leer no se descarta en silencio: queda como hallazgo, igual
que la plata que el desglose no alcanza a explicar.

Con el desglose leído, cada semana queda en uno de estos estados:

| Estado | Qué significa |
|---|---|
| `saldada` | Faltaba plata y volvió entera como Back Pay |
| `parcial` | Volvió una parte; la columna muestra solo lo que sigue faltando |
| `−$x` | Falta plata y todavía no volvió nada |
| `+$x` | El payslip pagó de más (casi siempre, un turno que nunca quedó en Deputy) |

Un reintegro nunca deja una semana en positivo: como mucho cubre lo que faltaba. Arriba de
la tabla semanal hay un resumen del reclamo entero — cuánto volvió, en cuántas semanas y
cuánto sigue abierto — que sale de la misma cuenta que el total del encabezado de hallazgos,
para que no puedan decir números distintos.

## Qué revisa

| Chequeo | Severidad |
|---|---|
| Quincena abierta por encima de 48 h | crítico |
| `Night Hours` en un payslip (sleepover interrumpido) | crítico |
| Quincena ya cerrada por encima del límite | crítico |
| Payslip que paga menos bruto del que da el roster | alto |
| El aporte jubilatorio no da el 12% | alto |
| Sleepovers liquidados ≠ sleepovers del roster | alto |
| Km declarados y no reembolsados | alto |
| Faltan payslips de días ya trabajados | alto |
| Quincena al 90% del límite | alto |
| Payslip que paga más bruto del que da el roster | medio |
| Back Pay que el desglose no imputa a ninguna semana | medio |
| Conceptos liquidados distinto de lo esperado, uno por uno | medio |
| La fórmula de retención dejó de reproducir un payslip | medio |
| Payslip cuya suma no da el total | medio |
| Broken Shift Allowance con lapso > 12 h | medio |
| Feriado pagado que no está en la tabla `holidays` | nota |
| Km declarados por encima de 20 (sin aprobación) | nota |
| Viaje mencionado sin cifra de km | nota |
| Semana que faltaba y ya volvió como Back Pay | nota |

Los dos primeros hallazgos de pago son de naturaleza distinta y conviene no confundirlos:
`pay-delta` es plata (el empleador liquidó distinto de lo que dice el roster), mientras que
`tax-model-drift`, `tax-table-missing` y `holiday-missing` son mantenimiento (la herramienta
se quedó vieja y hay que actualizarla, no hay nada que reclamar).

### Lo que encontró hasta ahora

Al 20 de agosto de 2026, sobre 35 semanas liquidadas: de los **$561.94** detectados el 18 de
agosto, el payslip del 13–19 de agosto devolvió **$348.36** en cuatro tramos. Quedan
**$213.04 abiertos** en 6 semanas:

| Semana | Falta | Volvió | Qué pasó |
|---|---|---|---|
| 15–21 ene 2026 | $131.50 | — | 5 h de domingo liquidadas a tarifa ordinaria |
| 23–29 abr 2026 | $43.53 | $115.08 | El reintegro pagó las horas, no el First Aid ni el turno partido |
| 9–15 jul 2026 | $20.82 | — | Sin analizar todavía |
| 26 feb – 4 mar 2026 | $13.91 | — | Sin analizar todavía |
| 12–18 feb 2026 | $2.16 | $131.52 | Quedó afuera el First Aid Allowance ($0.56/h) sobre esas horas |
| 6–12 ago 2026 | $1.12 | $68.88 | Ídem |

Solo 9–15 abr 2026 quedó saldada entera ($32.88). El patrón de las otras tres es el mismo:
**el back pay devuelve la hora ordinaria pero se olvida del First Aid Allowance** que va
sobre esas horas.

## Plan de recorte

Cuando alguna quincena abierta se pasa, la app elige de forma voraz qué turnos soltar:
primero los que arreglan más ventanas a la vez, y solo de hoy en adelante — el pasado ya
está trabajado y no se negocia. Genera además el mensaje para el manager, redactado como
pedido de reducción de carga, ofreciendo tomar turnos durante los term breaks.

## Comandos

```bash
npm run dev              # desarrollo
npm test                 # tests del motor de horas y de las reconciliaciones
npm run typecheck        # tsc --noEmit
npm run db:migrate       # importa data/*.json a Supabase (idempotente)
npm run payslips:import  # parsea los PDF del disco y los guarda en Supabase
npm run payslips:check   # parsea todos los PDF y reporta cuáles no cierran (sin tocar la base)
npm run forecast:check   # contrasta la estimación semanal contra los payslips reales
npx tsx scripts/inspect-payslip.ts "../payslips/06 aug - 12 aug.pdf"
npx tsx scripts/inspect-payslip.ts "<pdf>" --tokens   # volcado crudo con coordenadas
```

## Datos

Todo en Supabase. El esquema está en `supabase/migrations/0001_init.sql`.

| Tabla | Qué guarda |
|---|---|
| `deputy_tokens` | Tokens de Deputy, cifrados con AES-256-GCM usando una clave derivada del client secret. Sin el `.env` la tabla no sirve de nada. |
| `shifts` | Turnos sincronizados. `synced_at` marca la corrida que los escribió. |
| `sync_state` | Cuándo fue el último sync y con qué rango de fechas. |
| `payslips` | Payslips parseados. `lines` y `back_pay` en JSONB. |
| `term_breaks` | Calendario académico, editable desde la app. |
| `holidays` | Feriados de QLD y Toowoomba, editables desde el table editor de Supabase. |
| `shift_reports` | Reportes por turno. |

Los PDF de los payslips **no** se guardan: viven en tu disco (`PAYSLIPS_DIR`) y sólo los
lee `npm run payslips:import`. Al tocar `payslips/parse.ts` hay que correr ese comando de
nuevo — reparsea la carpeta entera y pisa las filas. Tiene que ser la carpeta completa y
no un archivo suelto: `inferSleepoverCounts` necesita todo el historial para separar las
eras salariales.

La carpeta `data/` queda como respaldo de la migración. Una vez que verifiques que la app
anda contra Supabase, se puede borrar.

## Pendiente

- **Login.** Sin autenticación la app no se puede publicar, aunque la base ya esté en la
  nube. El paso siguiente es Supabase Auth con RLS por usuario y reemplazar la
  `service_role` key del servidor por el JWT del usuario.

- Verificar si podés registrar el cliente OAuth; si no, implementar el login por navegador.
- Los `.png` de rosters en la carpeta padre quedan como respaldo visual: la fuente de
  datos es Deputy.
- Agregar el Toowoomba Show Day de 2027 a la tabla `holidays` cuando se publique.
- Cargar los coeficientes NAT 1004 del año fiscal 2027-28 antes del 1 de julio de 2027.
- El umbral de overtime (10 h pagables seguidas) sale de un solo caso en 35 semanas: está
  acotado por arriba pero no por abajo. Si aparece otro, confirmarlo.
