/** English catalogue. Typed against `es.ts`, which owns the keys: a missing key
 *  or a parameter that drifted out of shape fails the typecheck.
 *
 *  The audience is Julian himself and, where he chooses to forward something,
 *  an Australian employer. So award and payroll terms stay in their Australian
 *  form (Sleepover Allowance, Broken Shift Allowance, PAYG, super) rather than
 *  being translated into something a manager would not recognise. */

import type { Messages } from './es.js';

export const en: Messages = {
  // --- App shell ---
  'app.documentTitle': 'Horas · 8105 tracking and pay audit',
  'app.eyebrow': 'Internal tool · condition 8105',
  'app.title': 'Hours and pay',
  'app.loading': 'Loading…',
  'app.language': 'Language',
  'app.languageName': 'English',
  'app.error.unexpected': 'Unexpected error while loading the report.',
  'app.error.sync': 'Could not sync with Deputy.',
  'app.error.offline': 'Could not reach the local server. Is `npm run dev` running?',
  'app.error.auth': (p) => `Deputy login failed: ${p.reason}`,
  'app.error.status': (p) => `Error ${p.status}`,

  // --- Connection bar ---
  'connect.missing.lead':
    'OAuth credentials are missing. Register the client at once.deputy.com/my/oauth/list with redirect',
  'connect.missing.tail': 'and put DEPUTY_CLIENT_ID and DEPUTY_CLIENT_SECRET in your .env.',
  'connect.notAuthorised': "You haven't authorised the app yet. Login happens on Deputy's page.",
  'connect.login': 'Sign in with Deputy',
  'connect.session': 'Signed in',
  'connect.lastSync': (p) => `Last sync: ${p.when}`,
  'connect.never': 'never',
  'connect.syncing': 'Syncing…',
  'connect.sync': 'Sync',
  'connect.logout': 'Disconnect Deputy',

  // --- Sections ---
  'section.pay.title': 'What you are going to be paid',
  'section.pay.note': (p) =>
    `Pay week runs Thursday to Wednesday, paid the following Thursday · financial year ${p.taxYear}`,
  'section.pay.back': 'back to the next payment',
  'section.weeks.title': 'Week by week',
  'section.weeks.note': (p) =>
    `Financial year ${p.year}: ${p.gross} gross · ${p.tax} tax · ${p.superannuation} super, across ${p.count} payslips`,
  'section.drop.title': 'What to ask them to drop',
  'section.drop.note': (p) =>
    `${p.count} open fortnight${p.count === 1 ? '' : 's'} above the limit`,
  'section.findings.title': 'Findings',
  'section.findings.note': (p) =>
    `${p.count} in total · ${p.shortfall} of gross the roster says is missing · ${p.km} in unreimbursed km${
      p.hasRecovered ? ` · ${p.recovered} already recovered` : ''
    }`,
  'section.fortnights.title': 'All fortnights',
  'section.fortnights.note': (p) =>
    `Pick one to see it above · 14-day windows from every Monday · the vertical mark is the ${p.limit} h limit`,
  'app.signOut': 'Sign out',

  'tabs.fortnight': 'Fortnight',
  'tabs.pay': 'Pay',
  'tabs.review': 'Review',
  'tabs.reports': 'Reports',

  'section.payslips.title': 'Payslips',
  'section.payslips.note': (p) =>
    `${p.files} files read · ${p.paid} h paid against ${p.roster} h of roster`,
  'section.payslips.upload': 'Upload payslip',
  'section.payslips.uploading': 'Reading…',
  'section.payslips.uploaded': (p) =>
    p.replaced > 0
      ? `Done: ${p.added} new period(s) and ${p.replaced} updated. ${p.periods}`
      : `Done: ${p.added} new period(s). ${p.periods}`,
  'section.payslips.failures': (p) => `Could not read ${p.count} file(s): ${p.files}`,

  // --- Fortnight panel ---
  'gauge.empty': 'No shifts loaded yet. Sync with Deputy to see your current fortnight.',
  'gauge.position.past': 'Closed fortnight',
  'gauge.position.current': 'Current fortnight',
  'gauge.position.future': 'Future fortnight',
  'gauge.headline.pastUnder': (p) => `Closed with ${p.hours} h to spare`,
  'gauge.headline.pastOver': (p) => `Closed ${p.hours} h over`,
  'gauge.headline.left': (p) => `${p.hours} h left`,
  'gauge.headline.futureOver': (p) => `The roster puts you ${p.hours} h over`,
  'gauge.headline.currentOver': (p) => `You are ${p.hours} h over`,
  'gauge.verdict.past.ok': 'Closed within the limit.',
  'gauge.verdict.past.warning': 'Closed right on the edge, but within the limit.',
  'gauge.verdict.past.over':
    'Closed above the limit. The roster cannot fix this any more; it is worth knowing where you stand if anyone ever asks.',
  'gauge.verdict.current.ok': 'Within the limit. Nothing to do.',
  'gauge.verdict.current.warning':
    'On the edge. One more shift and you are over: better not to take extras this fortnight.',
  'gauge.verdict.current.over':
    'Above the limit. Ask them to drop shifts before the fortnight closes.',
  'gauge.verdict.future.ok': 'Within the limit on the current roster.',
  'gauge.verdict.future.warning':
    'On the edge with the current roster. Think twice before accepting an extra.',
  'gauge.verdict.future.over':
    'The current roster puts you over the limit, but there is still time to ask them to drop shifts.',
  'gauge.prev': 'Previous fortnight',
  'gauge.next': 'Next fortnight',
  'gauge.backToCurrent': 'back to the current one',
  'gauge.of': (p) => `of ${p.limit} h`,
  'gauge.aria': (p) => `${p.hours} of ${p.limit} hours in the fortnight ${p.range}`,
  'gauge.stat.total': 'Total including breaks',
  'gauge.stat.conservative': 'Worst-case reading',
  'gauge.stat.breakDays': 'Break days',

  // --- Fortnight ladder ---
  'ladder.empty': 'No fortnights to show.',
  'ladder.tooltip': (p) =>
    `${p.inSession} h in session · ${p.total} h total${p.breakDays ? ` · ${p.breakDays} break days` : ''}`,

  // --- Drop plan ---
  'drop.empty': (p) => `No open fortnight goes over ${p.limit} h. Nothing to ask them to drop.`,
  'drop.eyebrow': 'Suggested cut',
  'drop.headline': (p) =>
    `Dropping ${p.shifts} shift${p.shifts === 1 ? '' : 's'} gets you ${p.hours} h back`,
  'drop.note':
    'Ordered by impact: the ones that fix the most fortnights at once come first. Only shifts from today onwards, which are the only ones still movable.',
  'drop.managerMessage': 'Message for your manager',
  'drop.managerNote': 'Always in English: it is meant to be sent to your manager as is.',
  'drop.copy': 'Copy',
  'drop.copied': 'Copied',

  // --- Findings list ---
  'findings.empty':
    'No findings. Neither the fortnights nor the payslips show problems with the data loaded.',
  'findings.severity.critical': 'Critical',
  'findings.severity.high': 'High',
  'findings.severity.medium': 'Medium',
  'findings.severity.info': 'Note',
  'findings.category.visa': 'Visa',
  'findings.category.pay': 'Pay',
  'findings.category.km': 'Km',
  'findings.category.data': 'Data',

  // --- Findings: visa ---
  'f.visa.pastOver.title': (p) => `${p.count} closed fortnight(s) above ${p.limit} h`,
  'f.visa.pastOver.detail': (p) =>
    `The worst is ${p.range} with ${p.hours} h (+${p.over} h). This has already happened and the roster cannot fix it; it is worth knowing where you stand if anyone ever asks.`,
  'f.visa.over.title': (p) => `Open fortnight at ${p.hours} h (+${p.over} over the limit)`,
  'f.visa.over.detail': (p) =>
    `${p.range}: there is still time to ask them to drop shifts. Check the drop plan to see which ones.`,
  'f.visa.warn.title': (p) => `Fortnight on the edge: ${p.hours} h of ${p.limit}`,
  'f.visa.warn.detail': (p) =>
    `${p.range}: you have ${p.margin} h of margin left. Any extra shift puts you over.`,
  'f.visa.conservative.title': (p) =>
    `${p.count} fortnight(s) would go over if the whole sleepover counted`,
  'f.visa.conservative.detail': (p) =>
    `${p.range} would reach ${p.hours} h on the harshest reading, where the 8 h of the 22:00-06:00 band count as work. That is not the interpretation your payslips confirm, but it is worth having measured.`,

  // --- Findings: payslip against roster ---
  'f.sleepover.title': (p) =>
    `Sleepovers paid do not match (${p.paid} vs ${p.rostered} on the roster)`,
  'f.sleepover.detail': (p) =>
    `${p.range}: the roster has ${p.rostered} night(s) covering the 22:00-06:00 band and the payslip paid ${p.paid}.`,
  'f.arith.title': 'The payslip does not add up to its own total',
  'f.arith.detail': (p) =>
    `${p.file}: the line items do not sum to the declared Total Earnings (${p.total}). Something may be mis-entered.`,
  'f.night.title': (p) => `${p.hours} h of Night Hours: interrupted sleepover`,
  'f.night.detail': (p) =>
    `${p.range}: you were woken during the sleepover. Those hours were paid at the night rate and DO count towards the visa limit, even though the general sleepover rule excludes them. Add them to that fortnight by hand.`,
  'f.missingPayslip.title': 'Payslips missing for days already worked',
  'f.missingPayslip.detail': (p) =>
    `${p.range}: there are shifts on record but no payslip covering them. Ask for them so the pay can be checked.`,

  // --- Findings: broken shift ---
  'f.brokenShift.title': (p) =>
    `${p.count} days with two blocks more than ${p.maxSpan} h apart`,
  'f.brokenShift.detail': (p) =>
    `The worst case is ${p.date} with a ${p.span} h span. At that span these are not broken shifts but separate shifts, so the Broken Shift Allowance does not apply. If the employer argues they are broken shifts, then they are breaching the clause 25.6 cap and owe you double time for the hours past the twelfth. Read the clause before claiming.`,

  // --- Findings: km ---
  'f.km.title': (p) => `${p.km} km unreimbursed (${p.money})`,
  'f.km.detail': (p) =>
    `${p.range}: you declared ${p.declared} km and were paid ${p.paidMoney} (${p.paidKm} km at $${p.rate}/km). Shifts with km: ${p.shifts}.`,
  'f.km.noDetail': 'no detail',
  'f.km.titleSettled': (p) => `${p.km} km reimbursed in a later payslip (${p.money})`,
  'f.km.settledNote': (p) =>
    ` These were reimbursed: ${p.money} (${p.km} km) arrived in the ${p.date} payment.`,
  'f.km.partialNote': (p) =>
    ` Of those, ${p.money} (${p.km} km) came back in the ${p.date} payment; the rest is still open.`,
  'f.kmLimit.title': (p) => `${p.km} km declared is over the ${p.limit} km limit`,
  'f.kmLimit.detail': (p) =>
    `${p.date}: above ${p.limit} km you need manager approval, otherwise it can be rejected.`,
  'f.kmVague.title': 'You mentioned travel without noting the km',
  'f.kmVague.detail': (p) =>
    `${p.date}: "${p.comment}". Without a figure it cannot be claimed retroactively; always write down the km.`,

  // --- Findings: pay ---
  'f.payDelta.titleShort': (p) => `You were paid ${p.money} less than the roster says`,
  'f.payDelta.titleOver': (p) => `You were paid ${p.money} more than the roster says`,
  'f.payDelta.detail': (p) =>
    `${p.range}: the roster gives ${p.expected} gross and the payslip paid ${p.actual}.`,
  'f.payDelta.overNote':
    ' Almost always this means a shift was paid but never recorded in Deputy, not that you were overpaid.',
  'f.payDelta.titleSettled': (p) => `You recovered ${p.money} from this week`,
  'f.payDelta.settledNote': (p) =>
    ` That shortfall came back as Back Pay: ${p.money} paid on ${p.date}. This week is settled.`,
  'f.payDelta.titlePartial': (p) => `${p.money} is still missing after the Back Pay`,
  'f.payDelta.partialNote': (p) =>
    ` The Back Pay on ${p.date} returned ${p.money}, but it did not cover the whole shortfall: the rest is still unpaid.`,
  'f.backPay.title': (p) => `${p.money} of Back Pay not allocated to any week`,
  'f.backPay.detail': (p) =>
    `The payslip for ${p.range} paid ${p.amount} of Back Pay and the breakdown only explains ${p.count} week(s). Without a breakdown the week that claimed it cannot be settled.${p.lines ? ` Unreadable lines: ${p.lines}.` : ''}`,
  'f.payLines.title': (p) => `${p.count} item(s) paid differently from what was expected`,
  'f.payLines.item': (p) => `${p.label}: expected ${p.expected}, paid ${p.actual}`,
  'f.payLines.hoursNote': (p) =>
    ` Hours: the roster gives ${p.expected} and the payslip paid ${p.actual}.`,
  'f.payLines.detail': (p) => `${p.range} — ${p.differences}.${p.hoursNote}`,
  'f.holidayMissing.title': 'The payslip paid a public holiday missing from the local calendar',
  'f.holidayMissing.detail': (p) =>
    `${p.range}: ${p.hours} h were paid as Public Holiday but no shift that week falls on a date in \`data/holidays.json\`. Days worked: ${p.dates}. Add whichever one applies.`,
  'f.taxDrift.title': (p) => `The withholding formula does not reproduce ${p.count} payslip(s)`,
  'f.taxDrift.sample': (p) =>
    `${p.date}: gross ${p.gross}, formula ${p.expected}, withheld ${p.actual}`,
  'f.taxDrift.detail': (p) =>
    `The ATO table loaded in the app no longer matches what payroll withholds. It could be a change of scale (study loan, tax residency) or a new table. Until that is resolved, the estimated tax is indicative only. ${p.samples}.`,
  'f.superDrift.title': (p) => `Super does not come to ${p.rate} on ${p.count} payslip(s)`,
  'f.superDrift.sample': (p) => `${p.date}: expected ${p.expected}, contributed ${p.actual}`,
  'f.superDrift.detail': (p) => `Base = Total Earnings minus overtime. ${p.samples}.`,
  'f.taxTable.title': 'The withholding table in use is from an earlier financial year',
  'f.taxTable.detail': (p) =>
    `The payment on ${p.date} falls in a financial year the app has no coefficients for. It is using the newest table available, so the estimated tax may be off. Update \`shared/pay/tax.ts\` with the current year's NAT 1004.`,

  // --- Pay cheque ---
  'pay.empty': 'No shifts yet to estimate a payment. Sync with Deputy.',
  'pay.basis.payslip': 'paid',
  'pay.basis.timesheet': 'hours clocked',
  'pay.basis.roster': 'published roster',
  'pay.basis.mixed': 'clocked + roster',
  'pay.basis.empty': 'no shifts',
  'pay.basisNote.payslip': 'The payslip has arrived: this row shows what actually landed.',
  'pay.basisNote.timesheet':
    'The hours are already clocked in Deputy, so the number is firm unless the employer pays it differently.',
  'pay.basisNote.roster':
    'Based on the published roster. If a shift changes, the number changes.',
  'pay.basisNote.mixed': 'Part of the week is clocked and part is still roster.',
  'pay.basisNote.empty': 'No shifts loaded for this week.',
  'pay.headline.empty': 'You have no shifts loaded that week',
  'pay.headline.actual': 'This is what landed',
  'pay.headline.roster': 'This is what would land if the roster holds',
  'pay.headline.mixed': 'This is what is building up',
  'pay.headline.forecast': 'This is what is going to land',
  'pay.depositedOn': (p) => `Paid on ${p.date}`,
  'pay.depositsOn': (p) => `Lands on ${p.date}`,
  'pay.toAccount': 'into your account',
  'pay.legend.net': (p) => `net ${p.money}`,
  'pay.legend.tax': (p) => `tax ${p.money}`,
  'pay.barAria': (p) => `Of ${p.gross} gross, ${p.net} is net and ${p.tax} goes to tax`,
  'pay.range': (p) =>
    `Week ${p.range} · ${p.paidHours} h paid · ${p.visaHours} h towards the visa`,
  'pay.stat.gross': 'Gross',
  'pay.stat.tax': (p) => `Tax (${p.year})`,
  'pay.stat.super': 'Super (to the fund)',
  'pay.stat.reimbursements': 'Travel costs',
  'pay.caption.actual': 'What the roster says you should have been paid',
  'pay.caption.forecast': 'Item by item',
  'pay.delta': (p) =>
    `The roster gave ${p.expected} gross and the payslip paid ${p.actual}: ${p.missing ? 'short by' : 'over by'} ${p.amount}.`,

  // --- Week-by-week table ---
  'pay.weeks.empty': 'No weeks to show.',
  'pay.col.week': 'Week',
  'pay.col.payment': 'Paid',
  'pay.col.basis': 'Basis',
  'pay.col.hours': 'Hours',
  'pay.col.gross': 'Gross',
  'pay.col.tax': 'Tax',
  'pay.col.super': 'Super',
  'pay.col.bank': 'To bank',
  'pay.col.delta': 'vs payslip',
  'pay.col.deltaTitle':
    "Payslip gross against roster gross. Red is what's missing, amber what's extra.",
  'pay.closes': 'matches',
  'pay.settled': 'settled',
  'pay.settledTitle': (p) => `${p.money} was missing and came back as Back Pay on ${p.date}.`,
  'pay.partialTitle': (p) =>
    `The Back Pay on ${p.date} returned ${p.money}; this is what is still missing.`,
  'pay.total': (p) => `Total (${p.count} weeks)`,

  // --- Back Pay roll-up ---
  'backPay.eyebrow': 'Back Pay',
  'backPay.recovered': (p) =>
    `${p.money} came back on ${p.date}`,
  'backPay.weeks': (p) =>
    `spread over ${p.count} past week${p.count === 1 ? '' : 's'}, per the payslip comments`,
  'backPay.open': (p) =>
    `${p.money} still missing across ${p.count} week${p.count === 1 ? '' : 's'}`,
  'backPay.clear': 'No short week is left unpaid',

  // --- Payslips table ---
  'payslips.empty': 'No payslip was read. Check that PAYSLIPS_DIR points at the right folder.',
  'payslips.col.period': 'Period',
  'payslips.col.hours': 'Hours',
  'payslips.col.sleepovers': 'Sleepovers',
  'payslips.col.nightHours': 'Night h',
  'payslips.col.travel': 'Travel',
  'payslips.col.gross': 'Gross',
  'payslips.col.net': 'Net',
  'payslips.col.status': 'Status',
  'payslips.total': (p) => `Total (${p.count})`,
  'payslips.ok': 'ok',
  'payslips.mismatch': 'does not add up',
  'payslips.backPay': (p) => `back pay ${p.money}`,
  'payslips.backPayTitle': (p) =>
    `Back pay for ${p.count} earlier week(s): ${p.weeks}. This is not money for this week.`,

  // --- Shift reports ---
  'section.reports.title': 'Shift reports',
  'section.reports.note': (p) =>
    `Completed shifts with ${p.client} since ${p.from} · ${p.pending} not written up`,
  'reports.empty': (p) =>
    `No completed shifts with ${p.client} in range. Sync with Deputy if one is missing.`,
  'reports.noApiKey':
    'ANTHROPIC_API_KEY is missing from .env: you can record and save, but not draft.',
  'form.map': 'Map to form',
  'form.mapping': 'Mapping…',
  'form.mapHint':
    'Reads the Deputy note into the 25 form questions and flags what is missing.',
  'form.manualEntry': 'Manual entry (behaviours, presentation, support)',
  'form.generate': 'Generate form',
  'form.generating': 'Generating…',
  'form.bookmarklet': 'Copy fill bookmarklet',
  'form.bookmarkletCopied': 'Copied · paste into a new bookmark',
  'form.bookmarkletHelp':
    'Paste it as the URL of a new bookmark. Then open the form and click the bookmark: the questions fill in, and you press Submit yourself. It carries this shift\'s answers inside, so copy it again if you regenerate.',
  'form.openForm': 'Open form ↗',
  'form.step.copy': 'Copy the bookmarklet (first time, save it to your bookmarks bar).',
  'form.step.open': 'Open the form in another tab.',
  'form.step.click': 'Click the bookmark there: the questions fill in. You review and press Submit.',
  'form.output': 'Form answers, ready to paste',
  'form.review.title': 'Form completion review',
  'form.review.count': (p) =>
    p.open === 0
      ? `nothing to confirm · ${p.required} required still empty`
      : `${p.open} to confirm · ${p.required} required still empty`,
  'form.review.documented': 'Confirmed from source',
  'form.review.confirmed': 'Confirmed by you',
  'form.review.needed': 'Needs confirmation',
  'form.review.unavailable': 'Cannot be determined',
  'form.review.shortAnswer': 'Short answer',
  'form.review.foot':
    'Only documented and confirmed answers reach the form. Anything pending stays out.',
  'form.unverified': (p) =>
    `Options not yet checked against the real form: ${p.fields}. Fix them in shared/form/schema.ts`,
  'reports.expand': 'Show',
  'reports.collapse': 'Fold',
  'reports.foldedSummary': (p) => `${p.answers} answers · generated ${p.when}`,
  'reports.tab.pending': (p) => `Pending (${p.count})`,
  'reports.tab.archived': (p) => `Archived (${p.count})`,
  'reports.emptyArchived':
    'Nothing archived yet. A shift moves here when you mark it as submitted.',
  'reports.checkNew': 'Check for new shifts',
  'reports.checking': 'Checking…',
  'reports.foundNew': (p) =>
    p.count === 1 ? '1 new shift to report' : `${p.count} new shifts to report`,
  'reports.noNew': 'No new shifts.',
  'reports.status.pending': 'not written up',
  'reports.status.drafted': 'drafted',
  'reports.status.submitted': 'submitted',
  'reports.behaviours': 'Behaviours observed',
  'reports.behavioursNote':
    'Tick only what you saw, with the real figure. The write-up uses these numbers.',
  'reports.unit.times': 'times',
  'reports.unit.minutes': 'minutes',
  'reports.notePlaceholder': 'What happened, in your own words',
  'reports.presentationNote': 'Tap what applies. This alone is enough to draft the shift.',
  'reports.presentation.freeText': 'Anything else that does not fit above',
  'reports.group.mood': 'Mood',
  'reports.group.sleep': 'Sleep',
  'reports.group.appetite': 'Appetite',
  'reports.group.engagement': 'Engagement',
  'reports.moreDetail': 'detail',
  'reports.lessDetail': 'hide',
  'reports.presentation.label': 'How the client presented',
  'reports.presentation.placeholder':
    'Mood, sleep, appetite, engagement. A settled shift gets described here too.',
  'reports.support.label': 'Support you provided',
  'reports.support.placeholder': 'What you did and how they responded.',
  'reports.deputyComment': 'Deputy comment',
  'reports.noDeputyComment': 'No Deputy comment for this shift.',
  'reports.save': 'Save',
  'reports.saving': 'Saving…',
  'reports.saved': 'Saved',
  'reports.draftedAt': (p) => `Drafted ${p.when}`,
  'reports.copy': 'Copy',
  'reports.copied': 'Copied',
  'reports.markSubmitted': 'Mark as submitted',
  'reports.unmarkSubmitted': 'Back to pending',
  'reports.openForm': 'Open form',
  'reports.needMaterial':
    'Tick at least one behaviour or describe how they presented before drafting.',

  // --- Server messages ---
  'server.sync.rangeInvalid': 'Invalid range: "from" is after "to".',
  'server.sync.noEmployeeId':
    'Could not work out your employeeId. Set it by hand in DEPUTY_EMPLOYEE_ID in the .env.',
  'server.sync.rosterWarning': (p) => `Could not read the published roster: ${p.reason}`,
  'server.payslips.empty': 'No file received.',
  'server.payslips.notPdf': 'That file is not a PDF.',
  'server.auth.missingCredentials':
    'DEPUTY_CLIENT_ID and DEPUTY_CLIENT_SECRET are missing from the .env. Register the OAuth client at https://once.deputy.com/my/oauth/list',
  'server.termBreaks.notAList': 'Expected a list of periods.',
  'server.reports.nothingToFinalise':
    'Nothing has been mapped to the form yet. Run "Map to form" first.',
  'server.reports.unknownShift':
    'That shift is not one of the ones that need a report. Sync with Deputy and try again.',
  'server.termBreaks.badDates': 'Every period needs "start" and "end" in YYYY-MM-DD format.',
};
