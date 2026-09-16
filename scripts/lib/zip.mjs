// Минимальный ZIP-ридер без внешних зависимостей (только node:fs + node:zlib).
// Поддерживает обычный ZIP (central directory, deflate/store) — этого достаточно
// для датасетов ФНС open data. ZIP64 (файлы >4 ГБ или >65535 записей) не
// поддерживается и приведёт к понятной ошибке — все датасеты в этом проекте
// значительно меньше.
import { openSync, readSync, closeSync, fstatSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function readFileBuffer(fd, position, length) {
  const buf = Buffer.alloc(length);
  readSync(fd, buf, 0, length, position);
  return buf;
}

/** Возвращает список записей архива: { name, compressedSize, uncompressedSize, method, localHeaderOffset }. */
export function listZipEntries(filePath) {
  const fd = openSync(filePath, "r");
  try {
    const fileSize = fstatSync(fd).size;
    const tailLen = Math.min(fileSize, 65557); // 22 (EOCD) + макс. 65535 байт комментария
    const tail = readFileBuffer(fd, fileSize - tailLen, tailLen);

    let eocdPos = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos === -1) throw new Error(`${filePath}: не найдена сигнатура EOCD — файл не является ZIP или использует ZIP64`);

    const totalEntries = tail.readUInt16LE(eocdPos + 10);
    const cdSize = tail.readUInt32LE(eocdPos + 12);
    const cdOffset = tail.readUInt32LE(eocdPos + 16);
    if (cdOffset === 0xffffffff) throw new Error(`${filePath}: обнаружен ZIP64 — не поддерживается этим минимальным ридером`);

    const cd = readFileBuffer(fd, cdOffset, cdSize);
    const entries = [];
    let pos = 0;
    for (let i = 0; i < totalEntries; i++) {
      if (cd.readUInt32LE(pos) !== CENTRAL_SIG) throw new Error(`${filePath}: повреждённая центральная директория ZIP (запись ${i})`);
      const method = cd.readUInt16LE(pos + 10);
      const compressedSize = cd.readUInt32LE(pos + 20);
      const uncompressedSize = cd.readUInt32LE(pos + 24);
      const nameLen = cd.readUInt16LE(pos + 28);
      const extraLen = cd.readUInt16LE(pos + 30);
      const commentLen = cd.readUInt16LE(pos + 32);
      const localHeaderOffset = cd.readUInt32LE(pos + 42);
      const name = cd.toString("utf8", pos + 46, pos + 46 + nameLen);
      entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    closeSync(fd);
  }
}

/** Читает и распаковывает одну запись архива в Buffer (все записи в датасетах ФНС небольшие — целиком в память). */
export function readZipEntry(filePath, entry) {
  const fd = openSync(filePath, "r");
  try {
    // Локальный заголовок имеет собственные длины имени/extra — нельзя полагаться на значения из central directory.
    const localHeader = readFileBuffer(fd, entry.localHeaderOffset, 30);
    if (localHeader.readUInt32LE(0) !== LOCAL_SIG) throw new Error(`${filePath}: повреждённый локальный заголовок для ${entry.name}`);
    const nameLen = localHeader.readUInt16LE(26);
    const extraLen = localHeader.readUInt16LE(28);
    const dataOffset = entry.localHeaderOffset + 30 + nameLen + extraLen;
    const compressed = readFileBuffer(fd, dataOffset, entry.compressedSize);
    if (entry.method === 0) return compressed; // STORED
    if (entry.method === 8) return inflateRawSync(compressed); // DEFLATE
    throw new Error(`${filePath}: неподдерживаемый метод сжатия ${entry.method} для ${entry.name}`);
  } finally {
    closeSync(fd);
  }
}
