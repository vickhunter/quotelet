// D-004c: English words that must never appear on the Italian builder or share page.
// Built from every word in the EN dictionary, core formula errors and the widget's EN copy,
// minus words Italian uses as-is (formula, email, link, WhatsApp, JSON, IVA, mq...).
// Short words that are also Italian (a, e, in, no, per, come, con...) are left out on purpose.
export const ENGLISH_WORDS = new Set(
  `the your you and with to of for from this that these those it its is are be been was were will can could
  should must not only too here there when what how much does do cost costs get got
  build built calculator calculators free account draft browser stays stay home main
  template templates business name names number numbers optional questions question price prices
  starts start starting default option options label labels ticked tick unticked
  include includes included including vat use digits country code short long leave empty share sharing
  copy copied clipboard embed download open preview live pick first fix add page refresh again try
  load loading loaded error errors unknown identifier position expected unexpected ended end
  assignment allowed character characters nested deeply followed argument arguments needs takes exactly
  comparisons missing operator between values value string longer parsed
  message language translation unavailable standard writing cut off ask own looks looked
  quote quotes estimate estimated made send sent click tap enter answer answers required field fields
  phone wall walls room rooms paint painting painter colour color white yes total range
  week weeks day days hour hours yours ours please thanks welcome back next previous close done save saved
  go found not`.split(/\s+/).filter(Boolean),
)
