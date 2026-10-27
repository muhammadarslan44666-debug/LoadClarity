const clean = (value) => String(value ?? '').replace(/[\t\u00a0]+/g, ' ').replace(/\s+/g, ' ').trim();
const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const DATE_RE = String.raw`(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})`;


const US_STATE_CODES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
function stripLocationLabel(value) {
  return clean(value).replace(/^(?:street\s*)?address\s*[:#-]\s*/i, '')
    .replace(/^(?:city|town|state|st|zip(?:\s*code)?|postal\s*code)\s*[:#-]\s*/i, '')
    .replace(/^(?:appointment(?:\s*(?:\/\s*)?(?:time|window))?|appt(?:\s*(?:\/\s*)?window)?|window|pickup|delivery)\s*[:#-]\s*/i, '')
    .replace(/[;,\s]+$/, '').trim();
}
function splitUSAddress(value) {
  const raw = stripLocationLabel(value);
  if (!raw) return null;
  // Accept street + city/state/ZIP in one line, with either comma or whitespace separators.
  const patterns = [
    /^(.*?\d[^,]*?)\s*,\s*([^,]+?)\s*,\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i,
    /^(.*?\d[^,]*?)\s*,\s*([^,]+?)\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i,
    /^(.*?\d[^,]*?)\s+([^,]+?)\s*,\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m && US_STATE_CODES.has(m[3].toUpperCase())) return { address: stripLocationLabel(m[1]), city: stripLocationLabel(m[2]).replace(/,$/, ''), state: m[3].toUpperCase(), zip: m[4] };
  }
  const cityStateZip = raw.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i);
  if (cityStateZip && US_STATE_CODES.has(cityStateZip[2].toUpperCase())) return { city: stripLocationLabel(cityStateZip[1]), state: cityStateZip[2].toUpperCase(), zip: cityStateZip[3] };
  const cityState = raw.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (cityState && US_STATE_CODES.has(cityState[2].toUpperCase())) return { city: stripLocationLabel(cityState[1]), state: cityState[2].toUpperCase() };
  return null;
}
function normalizeLocationFields(result, prefix) {
  const key = (field) => `${prefix}_${field}`;
  for (const field of ['address', 'city', 'state', 'zip', 'appointment']) {
    if (has(result[key(field)])) result[key(field)] = stripLocationLabel(result[key(field)]);
  }
  const address = result[key('address')];
  const parsed = address ? splitUSAddress(address) : null;
  if (parsed) {
    // Preserve explicit, already-separated fields; use address-derived values only to fill or repair contaminated values.
    if (!has(result[key('city')]) || /,|\b\d{5}\b|\b[A-Z]{2}\b/.test(result[key('city')])) result[key('city')] = parsed.city || result[key('city')];
    if (!has(result[key('state')]) || !/^[A-Z]{2}$/i.test(result[key('state')])) result[key('state')] = parsed.state || result[key('state')];
    if (!has(result[key('zip')]) || !/^\d{5}(?:-\d{4})?$/.test(result[key('zip')])) result[key('zip')] = parsed.zip || result[key('zip')];
    result[key('address')] = parsed.address || address;
  }
  // City fields can themselves contain the full postal line when source PDFs use inconsistent labels.
  const cityValue = result[key('city')];
  if (has(cityValue)) {
    const cityParsed = splitUSAddress(cityValue);
    if (cityParsed) {
      if (!has(result[key('address')]) && cityParsed.address) result[key('address')] = cityParsed.address;
      result[key('city')] = cityParsed.city || '';
      if (!has(result[key('state')])) result[key('state')] = cityParsed.state || '';
      if (!has(result[key('zip')])) result[key('zip')] = cityParsed.zip || '';
    } else {
      result[key('city')] = stripLocationLabel(cityValue).replace(/\s*,\s*$/, '');
    }
  }
  if (has(result[key('state')])) {
    const state = stripLocationLabel(result[key('state')]).toUpperCase();
    result[key('state')] = US_STATE_CODES.has(state) ? state : '';
  }
  if (has(result[key('zip')])) result[key('zip')] = result[key('zip')].match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || '';
}

function firstMatch(text, patterns, transform = clean) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && has(match[1])) return transform(match[1]);
  }
  return '';
}

export function normalizeRateConDate(value) {
  if (!value) return '';
  const s = clean(value).replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[,]?\s*/i, '');
  let m = s.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const month = Number(m[1]); const day = Number(m[2]);
    const d = new Date(Number(year), month - 1, day);
    if (d.getFullYear() !== Number(year) || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  m = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00:00`);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

const TITLE = /\b(?:rate\s*confirmation|carrier\s*agreement|load\s*confirmation|confirmation\s*sheet|ratecon)\b/i;
const PICKUP = /\b(?:pickup|pick\s*up|origin|ship\s*from|shipper|loading\s*location|pickup\s*1)\b/i;
const DELIVERY = /\b(?:delivery|deliver\s*to|destination|consignee|receiver|unloading\s*location|delivery\s*1)\b/i;
const SECTION_HEADING = /^(?:pickup|pick\s*up|pickup\s*1|origin|shipper|delivery|delivery\s*1|destination|consignee|receiver)(?:\s*(?:details|information|location|address|#?\d+)?)?\s*:?$/i;

function getSectionLines(lines, type) {
  const startRe = type === 'pickup' ? PICKUP : DELIVERY;
  const otherRe = type === 'pickup' ? DELIVERY : PICKUP;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (startRe.test(line) && (SECTION_HEADING.test(line) || /\b(?:company|facility|address|city|state|zip|date|appointment|appt|window|from|to)\b/i.test(line))) { start = i; break; }
  }
  if (start < 0) return [];
  let end = Math.min(lines.length, start + 14);
  for (let i = start + 1; i < end; i++) {
    if ((otherRe.test(lines[i]) && (SECTION_HEADING.test(lines[i]) || /\b(?:company|facility|address|city|state|zip|date|appointment|appt|window)\b/i.test(lines[i]))) || /^(?:load\s*(?:details|information)|commodity|weight|loaded\s*miles|deadhead\s*miles|broker\s*(?:name|mc)|rate\s*confirmation)\b/i.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end);
}

function labeledValue(lines, labels) {
  const labelRe = new RegExp(`^(?:${labels})\\s*[:#-]?\\s*(.*)$`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]); const m = line.match(labelRe);
    if (!m) continue;
    if (has(m[1])) return clean(m[1]);
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const next = clean(lines[j]);
      if (next && !/^[\w /()-]+\s*[:#-]\s*$/.test(next)) return next;
    }
  }
  return '';
}

function parseLocationBlock(lines, prefix) {
  const result = {};
  if (!lines.length) return result;
  const joined = lines.join('\n');
  const put = (key, value) => { if (has(value)) result[`${prefix}_${key}`] = clean(value); };
  const company = labeledValue(lines, 'company(?:\\s*name)?|facility(?:\\s*name)?|shipper(?:\\s*name)?|receiver(?:\\s*name)?|consignee(?:\\s*name)?|pickup\\s*at|deliver\\s*to|name');
  const address = labeledValue(lines, 'street\\s*address|address|street');
  const city = labeledValue(lines, 'city|town');
  const state = labeledValue(lines, 'state|st');
  const zip = labeledValue(lines, 'zip(?:\\s*code)?|postal\\s*code');
  put('company', company);
  put('address', address);
  put('city', city?.replace(/,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/, ''));
  if (state && /^[A-Za-z]{2}$/.test(state)) put('state', state.toUpperCase());
  if (zip) { const z = zip.match(/\b\d{5}(?:-\d{4})?\b/); if (z) put('zip', z[0]); }

  // Common positional address format: Company / street / City, ST ZIP.
  const useful = lines.map(clean).filter(Boolean).filter((line) => !SECTION_HEADING.test(line));
  for (let i = 0; i < useful.length; i++) {
    let m = useful[i].match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
    if (m) { if (!result[`${prefix}_city`]) put('city', m[1]); if (!result[`${prefix}_state`]) put('state', m[2]); if (!result[`${prefix}_zip`]) put('zip', m[3]); continue; }
    m = useful[i].match(/^(.+?),\s*([A-Z]{2})\s*$/);
    if (m && !/^(?:company|address|city|state|zip|date)$/i.test(m[1])) { if (!result[`${prefix}_city`]) put('city', m[1]); if (!result[`${prefix}_state`]) put('state', m[2]); }
  }
  if (!result[`${prefix}_address`]) {
    const addr = useful.find((line) => /\b\d{1,6}\s+[A-Za-z0-9]/.test(line) && !new RegExp(DATE_RE, 'i').test(line));
    if (addr && !/\b(?:loaded|deadhead)\s*miles\b/i.test(addr)) put('address', addr.replace(/^address\s*[:#-]\s*/i, ''));
  }
  if (!result[`${prefix}_company`]) {
    const candidate = useful.find((line) => !/^\d{1,6}\s/.test(line) && !new RegExp(DATE_RE, 'i').test(line) && !/\b(?:city|state|zip|address|date|appointment|appt|phone|email|weight|miles|rate)\s*[:#-]/i.test(line) && !/\b[A-Z]{2}\s+\d{5}\b/.test(line) && !/\b\d{1,6}\s+[A-Za-z]/.test(line));
    if (candidate && !TITLE.test(candidate)) put('company', candidate.replace(/^(?:company|facility|shipper|receiver|consignee)\s*[:#-]\s*/i, ''));
  }
  const dateLine = lines.find((line) => new RegExp(DATE_RE, 'i').test(line) && /\b(?:date|appointment|appt|window|pickup|delivery|arrival|ship|receive|load|unload)\b/i.test(line)) || lines.find((line) => new RegExp(`^\\s*${DATE_RE}(?:\\s|$)`, 'i').test(line));
  if (dateLine) { const d = dateLine.match(new RegExp(DATE_RE, 'i'))?.[0]; put('date', normalizeRateConDate(d)); }
  const appointment = firstMatch(joined, [/(?:appointment(?:\s*(?:\/\s*)?(?:time|window))?|appt(?:\s*(?:\/\s*)?(?:time|window))?|time\s*window|pickup\s*window|delivery\s*window)\s*[:#-]?\s*([^\n]+)/i]);
  if (appointment) put('appointment', appointment.replace(new RegExp(DATE_RE, 'i'), '').trim());
  return result;
}


// Handles side-by-side pickup/delivery columns found in many broker PDFs.
// Keep this based on the original line spacing; collapsing whitespace first destroys column boundaries.
function parseSideBySideStops(rawSource) {
  const rawLines = String(rawSource || '').replace(/\r/g, '\n').split('\n');
  const headingIndex = rawLines.findIndex((line) => /PICKUP\s*1?\s*\(ORIGIN\)/i.test(line) && /DELIVERY\s*1?\s*\(DESTINATION\)/i.test(line));
  if (headingIndex < 0) return {};
  const left = []; const right = [];
  for (let i = headingIndex + 1; i < Math.min(rawLines.length, headingIndex + 18); i++) {
    const line = rawLines[i];
    if (!line.trim()) { if (left.length || right.length) continue; else continue; }
    if (/TOTAL AGREED|LOAD SPECIFICATIONS|CARRIER AGREEMENT TERMS/i.test(line)) break;
    // Layout-preserving PDF extraction and pdftotext -layout both leave a wide gap between columns.
    const cells = line.trimEnd().split(/(?:\t+|\s{3,})/).map((x) => clean(x)).filter(Boolean);
    if (cells.length >= 2) { left.push(cells[0]); right.push(cells.slice(1).join(' ')); }
    else if (cells.length === 1) {
      // Lines belonging only to the right column are indented well beyond the left column.
      const leading = (line.match(/^\s*/) || [''])[0].length;
      if (leading > 55) right.push(cells[0]); else left.push(cells[0]);
    }
  }
  const parseStop = (arr, prefix) => {
    const out = {};
    const lines = arr.map(clean).filter(Boolean);
    const set = (key, value) => { if (has(value)) out[`${prefix}_${key}`] = clean(value); };
    // Remove headings and unrelated continuation text.
    const company = lines.find((x) => !/^(?:pickup|delivery)\s*date\s*:/i.test(x) && !/^appointment\s*\//i.test(x) && !/^(?:pickup|delivery)\s*notes\s*:/i.test(x) && !/^\d{1,6}\s/.test(x) && !/\b[A-Z]{2}\s+\d{5}\b/.test(x) && !TITLE.test(x));
    const address = lines.find((x) => /^\d{1,6}\s+[A-Za-z0-9]/.test(x) && !/\b(?:date|appointment|window)\b/i.test(x));
    const cityLine = lines.find((x) => /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(x));
    if (company) set('company', company.replace(/^(?:company|facility|shipper|receiver|consignee)\s*[:#-]\s*/i, ''));
    if (address) set('address', address);
    if (cityLine) { const m = cityLine.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/); if (m) { set('city', m[1]); set('state', m[2]); set('zip', m[3]); } }
    const dateLine = lines.find((x) => new RegExp(`${prefix}\\s*date`, 'i').test(x)) || lines.find((x) => new RegExp(DATE_RE, 'i').test(x) && /date/i.test(x));
    if (dateLine) { const d = dateLine.match(new RegExp(DATE_RE, 'i'))?.[0]; if (d) set('date', normalizeRateConDate(d)); }
    const appt = lines.find((x) => /appointment\s*\/\s*window|(?:pickup|delivery)\s*appointment/i.test(x));
    if (appt) { const m = appt.match(/(?:appointment\s*\/\s*window|(?:pickup|delivery)\s*appointment)\s*:?\s*(.*)/i); if (m?.[1]) set('appointment', m[1]); }
    return out;
  };
  return { ...parseStop(left, 'pickup'), ...parseStop(right, 'delivery') };
}

function parseLayoutSpecificLoadValues(rawSource) {
  const text = String(rawSource || '');
  const out = {};
  const put = (k, v) => { if (has(v)) out[k] = v; };
  if (/TOTAL AGREED FLAT RATE PAY/i.test(text)) {
    const section = text.split(/TOTAL AGREED FLAT RATE PAY/i)[1]?.split(/LOAD SPECIFICATIONS/i)[0] || '';
    const m = section.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (m) put('rate', Number(m[1].replace(/,/g, '')));
  }
  if (/LOAD SPECIFICATIONS/i.test(text)) {
    const section = text.split(/LOAD SPECIFICATIONS/i)[1]?.split(/CARRIER AGREEMENT TERMS/i)[0] || '';
    const wm = section.match(/\b([\d,]+)\s*lbs?\b/i); if (wm) put('weight_lb', Number(wm[1].replace(/,/g, '')));
    const mm = section.match(/\b([\d,]+)\s*(?:loaded\s*)?mi(?:les)?\b/i); if (mm) put('loaded_miles', Number(mm[1].replace(/,/g, '')));
    const em = section.match(/\b([\d,]+)\s*(?:deadhead|empty)\s*mi(?:les)?\b/i); if (em) put('deadhead_miles', Number(em[1].replace(/,/g, '')));
    const eq = section.match(/\b(\d{2,3}\s*ft\s*)?(Dry\s*Van|Reefer|Refrigerated|Flatbed|Step\s*Deck|Lowboy|Power\s*Only|Box\s*Truck)\b/i);
    if (eq) put('equipment_type', `${eq[1] || ''}${eq[2]}`.trim().toLowerCase().replace(/\s+/g, '_'));
    const cm = section.match(/\b(General Freight(?:\s*\/\s*Consumer)?(?:\s+Goods)?|[A-Za-z][A-Za-z /&-]{2,50})\b/i);
    if (cm && !/^(?:commodity|weight|equipment|loaded|pallet)/i.test(cm[1])) put('commodity', clean(cm[1]));
  }
  return out;
}

function parseRateConfirmation(text) {
  const source = String(text || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u200b\ufeff]/g, ' ');
  const lines = source.split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const flat = clean(source);
  const money = (value) => Number(value.replace(/[$,\s]/g, ''));
  const labeled = (patterns, transform = clean) => firstMatch(source, patterns, transform);
  const rate = labeled([/(?:gross\s*(?:rate|pay)|total\s*(?:rate|pay|amount)|load\s*rate|agreed\s*rate|line\s*haul|broker\s*rate|rate\s*\(?(?:USD|\$)?\)?)\s*[:=\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i, /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:gross|total|all[- ]in)/i], money);
  const loadedMiles = labeled([/(?:loaded\s*miles|loaded\s*mi\.?|trip\s*miles|total\s*miles)\s*[:=\-]?\s*([\d,]+(?:\.\d+)?)/i], (v) => Number(v.replace(/,/g, '')));
  const deadheadMiles = labeled([/(?:deadhead\s*miles|empty\s*miles|dh\s*miles)\s*[:=\-]?\s*([\d,]+(?:\.\d+)?)/i], (v) => Number(v.replace(/,/g, '')));
  const weight = labeled([/(?:commodity\s*)?(?:weight|load\s*weight|gross\s*weight)\s*(?:\(?(?:lbs?|pounds?)\)?)?\s*[:=\-]?\s*([\d,]+(?:\.\d+)?)/i, /\b([\d,]+)\s*(?:lbs?|pounds)\b/i], (v) => Number(v.replace(/,/g, '')));
  const commodity = labeled([/(?:commodity|product|freight\s*description|description\s*of\s*goods)\s*[:=\-]?\s*([^\n]+)/i]);
  const equipmentRaw = labeled([/(?:equipment(?:\s*type)?|trailer(?:\s*type)?|required\s*equipment)\s*[:=\-]?\s*(dry\s*van|reefer|refrigerated|flatbed|step\s*deck|lowboy|power\s*only|box\s*truck|[A-Za-z][^\n]{0,35})/i]);
  const equipmentMap = { 'dry van': 'dry_van', reefer: 'reefer', refrigerated: 'reefer', flatbed: 'flatbed', 'step deck': 'step_deck', lowboy: 'lowboy', 'power only': 'power_only', 'box truck': 'box_truck' };
  const equipment = equipmentRaw ? (equipmentMap[clean(equipmentRaw).toLowerCase()] || clean(equipmentRaw).toLowerCase().replace(/\s+/g, '_')) : '';
  let broker = labeled([/(?:brokerage\s*company|broker\s*(?:legal\s*)?name|brokerage|carrier\s*broker)\s*[:#-]\s*([^\n]+)/i]);
  if (!broker) {
    broker = lines.find((line) => /\b(?:logistics|brokerage|transportation|freight|trucking)\b/i.test(line) && !TITLE.test(line) && !/\brate\s*confirmation\b/i.test(line) && line.length < 90) || '';
  }
  broker = clean(broker).replace(/^(?:brokerage\s*company|broker\s*(?:legal\s*)?name|brokerage|carrier\s*broker)\s*[:#-]\s*/i, '').replace(/[|]+$/, '').trim();
  if (TITLE.test(broker)) broker = '';
  const brokerReference = firstMatch(source, [/BROKER\s*REF(?:ERENCE)?\s*#?\s*[:=-]?\s*([A-Z]{1,8}-\d{3,}|\d{4,})/i, /\b(TQL-\d{4,}|ILB-\d{4,})\b/i, /LOAD\s*(?:ID|REF(?:ERENCE)?|#|NUMBER)\s*[:#=-]?\s*([A-Z0-9-]{4,})/i, /(?:REFERENCE|REF)\s*(?:NUMBER|NO\.?|#)?\s*[:#=-]?\s*([A-Z]{2,}[- ]?[A-Z0-9-]{3,})/i]);
  const brokerMC = labeled([/\b(?:MC|FF)\s*(?:#|number|no\.?)?\s*[:#-]?\s*([0-9]{4,8})\b/i]);
  const brokerPhone = labeled([/(?:broker\s*)?(?:phone|telephone|dispatch\s*phone|contact\s*phone|tel)\s*[:#-]?\s*(\+?1?[\s().-]*\d{3}[\s().-]*\d{3}[\s.-]*\d{4})/i, /\b(\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})\b/]);
  const brokerEmail = labeled([/(?:broker\s*)?(?:email|e-mail|dispatch\s*email|contact\s*email)\s*[:#-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i]);
  const pickupLines = getSectionLines(lines, 'pickup');
  const deliveryLines = getSectionLines(lines, 'delivery');
  const pickup = parseLocationBlock(pickupLines, 'pickup');
  const delivery = parseLocationBlock(deliveryLines, 'delivery');
  const sideBySideStops = parseSideBySideStops(text);
  const layoutLoadValues = parseLayoutSpecificLoadValues(text);
  const globalLumper = labeled([/(?:lumper(?:\s*(?:fee|amount|charge))?)\s*[:=\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i], money);
  const detention = labeled([/(?:detention(?:\s*terms?|\s*policy|\s*after)?)\s*[:=\-]?\s*([^\n]+)/i]);
  const layover = labeled([/(?:layover(?:\s*terms?|\s*rate|\s*fee)?)\s*[:=\-]?\s*([^\n]+)/i]);
  const lumperTerms = labeled([/(?:lumper\s*terms?|lumper\s*instructions)\s*[:=\-]?\s*([^\n]+)/i]);
  const result = {
    broker_name: broker, broker_reference: brokerReference, broker_mc: brokerMC,
    broker_phone: brokerPhone, broker_email: brokerEmail,
    rate: rate || '', loaded_miles: loadedMiles || '', deadhead_miles: deadheadMiles || '',
    commodity, weight_lb: weight || '', equipment_type: equipment,
    lumper_amount: globalLumper || '', detention_terms: detention, layover_terms: layover, lumper_terms: lumperTerms,
    ...pickup, ...delivery,
    ...sideBySideStops,
    ...layoutLoadValues,
  };
  // Prefer the explicit broker identity in the document masthead over names found in stop columns.
  const mastheadBroker = lines.slice(0, 8).find((line) => /\b(?:logistics|brokerage|transportation|freight)\b/i.test(line) && !TITLE.test(line) && line.length < 90);
  const rawMasthead = clean(String(source.split('\n')[0]).split(/RATE CONFIRMATION/i)[0].split(/\s{3,}/)[0]);
  if (rawMasthead && /\b(?:logistics|brokerage|transportation|freight)\b/i.test(rawMasthead) && !/^broker\s/i.test(rawMasthead) && !TITLE.test(rawMasthead)) result.broker_name = rawMasthead;
  // Reject generic header labels accidentally captured as values.
  if (/^(?:broker|ref|broker ref|broker mc|date issued|dispatcher)$/i.test(result.broker_reference || '')) result.broker_reference = '';
  if (result.equipment_type && /^(?:loaded|miles|required|equipment)$/i.test(result.equipment_type)) result.equipment_type = '';
  if (/Lumper Fee[\s\S]{0,80}?Reimbursed/i.test(source) && !/Lumper Fee[^\n]*\$\s*\d/i.test(source)) result.lumper_amount = '';
  // The commodity can wrap over two physical lines in the specification table.
  const commoditySection = source.split(/LOAD SPECIFICATIONS/i)[1]?.split(/CARRIER AGREEMENT TERMS/i)[0] || '';
  const commodityMatch = commoditySection.match(/General Freight\s*\/\s*Consumer/i);
  if (commodityMatch) result.commodity = 'General Freight / Consumer Goods';
  const lumperSection = source.split(/Lumper Fee/i)[1]?.split(/TONU/i)[0] || '';
  if (/Reimbursed/i.test(lumperSection) && !/\$\s*\d/.test(lumperSection)) result.lumper_amount = '';

  normalizeLocationFields(result, 'pickup');
  normalizeLocationFields(result, 'delivery');

  // Final normalization pass: keep contact values and stop fields strictly typed,
  // regardless of whether the source used labels, inline values, or OCR text.
  const phoneMatch = (value) => String(value || '').match(/(?:\+?1[ .()-]*)?(?:\(?\d{3}\)?[ .-]*)\d{3}[ .-]*\d{4}/)?.[0] || '';
  const emailMatch = (value) => String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  result.broker_phone = phoneMatch(result.broker_phone) || phoneMatch(firstMatch(source, [/(?:broker|dispatch|contact|office)?\s*(?:phone|telephone|tel)\s*[:#-]?\s*([^\n]+)/i]));
  result.broker_email = emailMatch(result.broker_email) || emailMatch(firstMatch(source, [/(?:broker|dispatch|contact|office)?\s*(?:email|e-mail)\s*[:#-]?\s*([^\n]+)/i]));
  result.broker_mc = String(result.broker_mc || '').match(/\b(?:MC|FF)?\s*[-:# ]?\s*(\d{4,8})\b/i)?.[1] || '';
  result.broker_reference = clean(result.broker_reference).replace(/^(?:broker\s*)?(?:reference|ref|load\s*(?:id|number))\s*[:#-]?\s*/i, '');
  for (const prefix of ['pickup', 'delivery']) {
    const val = (key) => result[`${prefix}_${key}`];
    const setVal = (key, value) => { if (has(value)) result[`${prefix}_${key}`] = clean(value); };
    // If a city/company field contains a complete address, recover the address components.
    const locationCandidate = [val('address'), val('city'), val('company')].find((v) => has(v) && /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(v));
    const parsedAddress = locationCandidate ? splitUSAddress(locationCandidate) : null;
    if (parsedAddress) {
      if (!has(val('address')) || /\b[A-Z]{2}\s+\d{5}/i.test(val('address'))) setVal('address', parsedAddress.address);
      if (!has(val('city')) || /,|\d{5}/.test(val('city'))) setVal('city', parsedAddress.city);
      if (!has(val('state')) || !US_STATE_CODES.has(String(val('state')).toUpperCase())) setVal('state', parsedAddress.state);
      if (!has(val('zip')) || !/\d{5}/.test(val('zip'))) setVal('zip', parsedAddress.zip);
    }
    setVal('company', String(val('company') || '').replace(/^(?:company(?:\s*name)?|facility(?:\s*name)?|shipper|receiver|consignee)\s*[:#-]\s*/i, ''));
    setVal('address', String(val('address') || '').replace(/^(?:street\s*)?address\s*[:#-]\s*/i, ''));
    setVal('city', String(val('city') || '').replace(/^(?:city|town)\s*[:#-]\s*/i, '').replace(/,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i, '').trim());
    const state = String(val('state') || '').replace(/^state\s*[:#-]\s*/i, '').trim().toUpperCase();
    if (state) setVal('state', US_STATE_CODES.has(state) ? state : '');
    const zip = String(val('zip') || '').match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || '';
    if (zip) setVal('zip', zip);
    const appointment = String(val('appointment') || '').replace(/^(?:appointment(?:\s*(?:\/\s*)?(?:time|window))?|appt(?:\s*(?:\/\s*)?window)?|window|pickup|delivery)\s*[:#-]\s*/i, '').replace(/^\s*\/\s*window\s*[:#-]?\s*/i, '').trim();
    if (appointment) setVal('appointment', appointment);
    const date = normalizeRateConDate(val('date'));
    if (date) setVal('date', date);
    // Never retain a full postal address as a company name.
    if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(String(val('company') || ''))) {
      const c = String(val('company')).replace(/,?\s*[^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/i, '').trim();
      setVal('company', c);
    }
  }

  // Debugging aid: deliberately log the complete field map and missing mandatory fields.
  const mandatory = ['broker_name','broker_reference','broker_mc','broker_phone','broker_email','pickup_company','pickup_address','pickup_city','pickup_state','pickup_zip','pickup_date','pickup_appointment','delivery_company','delivery_address','delivery_city','delivery_state','delivery_zip','delivery_date','delivery_appointment','commodity','weight_lb','equipment_type','rate','loaded_miles','deadhead_miles','lumper_amount','detention_terms','layover_terms'];
  const missing = mandatory.filter((key) => !has(result[key]));
  if (typeof console !== 'undefined') console.info('[LoadClarity RateCon parser] Extracted JSON:', result, missing.length ? `Missing fields: ${missing.join(', ')}` : 'All tracked fields extracted');
  return Object.fromEntries(Object.entries(result).filter(([, value]) => has(value)));
}

export { parseRateConfirmation };

async function extractPdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); const rows = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform?.[5] ?? 0);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: item.transform?.[4] ?? 0, width: item.width ?? 0, text: item.str });
    }
    // Preserve the horizontal column gap in PDF text. A normal single-space join
    // merges Pickup and Delivery values into one string, which breaks stop parsing.
    pages.push([...rows.entries()].sort((a,b) => b[0]-a[0]).map(([,row]) => {
      const sorted = row.sort((a,b) => a.x-b.x);
      let line = '';
      let previous = null;
      for (const item of sorted) {
        if (previous) {
          const gap = item.x - (previous.x + previous.width);
          line += gap > 24 ? '     ' : ' ';
        }
        line += item.text;
        previous = item;
      }
      return line;
    }).join('\n'));
    onProgress?.(`Reading PDF page ${pageNumber} of ${pdf.numPages}…`);
  }
  let text = pages.join('\n');
  if (text.replace(/\s/g, '').length < 40) {
    const { createWorker } = await import('tesseract.js'); const worker = await createWorker('eng');
    try {
      const scanned = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.8 }); const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        scanned.push((await worker.recognize(canvas)).data.text); onProgress?.(`OCR scanning PDF page ${pageNumber} of ${pdf.numPages}…`);
      }
      text = scanned.join('\n');
    } finally { await worker.terminate(); }
  }
  return text;
}

export async function readRateConfirmation(file, onProgress) {
  if (!file) throw new Error('Choose a PDF or image first.');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'); const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) throw new Error('Unsupported file. Upload a PDF, PNG, JPG, or WEBP image.');
  onProgress?.('Preparing document…'); let text;
  if (isPdf) text = await extractPdfText(file, onProgress);
  else { const { createWorker } = await import('tesseract.js'); const worker = await createWorker('eng'); try { onProgress?.('Reading image with OCR…'); text = (await worker.recognize(file)).data.text; } finally { await worker.terminate(); } }
  const fields = parseRateConfirmation(text);
  if (!Object.keys(fields).length) throw new Error('No recognizable load details were found. Try a clearer scan or enter the details manually.');
  return { fields, text };
}
