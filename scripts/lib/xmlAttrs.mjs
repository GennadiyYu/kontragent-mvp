// Минимальный парсер для плоских атрибутных XML датасетов ФНС open data
// (схема ОТКРДАННЫЕ*): каждая запись — самозамкнутый тег вида
// <Тег Атр1="..." Атр2="..."/> внутри <Документ>...</Документ>. Полноценный
// XML-парсер не нужен — вложенности текстовых узлов в этих датасетах нет.
function decodeXmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Разбивает XML-файл датасета на блоки <Документ ...>...</Документ>. */
export function extractDocuments(xmlText) {
  const blocks = [];
  const openTag = "<Документ ";
  let pos = 0;
  while (true) {
    const start = xmlText.indexOf(openTag, pos);
    if (start === -1) break;
    const end = xmlText.indexOf("</Документ>", start);
    if (end === -1) break;
    blocks.push(xmlText.slice(start, end));
    pos = end + 11;
  }
  return blocks;
}

/** Извлекает атрибуты первого вхождения тега <tagName .../> из блока. Возвращает null, если тег не найден. */
export function extractTagAttrs(block, tagName) {
  const re = new RegExp(`<${tagName}\\s+([^>]*?)/?>`, "");
  const match = block.match(re);
  if (!match) return null;
  const attrsText = match[1];
  const attrs = {};
  const attrRe = /([\wА-Яа-яЁё]+)="([^"]*)"/g;
  let m;
  while ((m = attrRe.exec(attrsText))) {
    attrs[m[1]] = decodeXmlEntities(m[2]);
  }
  return attrs;
}

/** Извлекает атрибуты ВСЕХ вхождений тега <tagName .../> из блока (для повторяющихся элементов, напр. СведНедоим). */
export function extractAllTagAttrs(block, tagName) {
  const re = new RegExp(`<${tagName}\\s+([^>]*?)/?>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(block))) {
    const attrs = {};
    const attrRe = /([\wА-Яа-яЁё]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[1]))) attrs[a[1]] = decodeXmlEntities(a[2]);
    out.push(attrs);
  }
  return out;
}

/** ДД.ММ.ГГГГ → YYYY-MM-DD (формат дат во всех датасетах ФНС open data). Возвращает null, если формат не распознан. */
export function parseRuDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
