const fs = require('fs');

function decodeAxml(buf) {
  let pos = 8;
  const chunkType = buf.readUInt16LE(pos);
  const headerSize = buf.readUInt16LE(pos + 2);
  const chunkSize = buf.readUInt32LE(pos + 4);
  const stringCount = buf.readUInt32LE(pos + 8);
  const flags = buf.readUInt32LE(pos + 16);
  const isUtf8 = (flags & (1 << 8)) !== 0;
  const stringsStart = pos + buf.readUInt32LE(pos + 20);

  const offsets = [];
  for (let i = 0; i < stringCount; i++) {
    offsets.push(buf.readUInt32LE(pos + 28 + i * 4));
  }

  const strings = [];
  for (let i = 0; i < stringCount; i++) {
    const spos = stringsStart + offsets[i];
    if (isUtf8) {
      let u16len = buf.readUInt8(spos);
      let off = 1;
      if (u16len & 0x80) off++;
      let u8len = buf.readUInt8(spos + off);
      off++;
      if (u8len & 0x80) off++;
      strings.push(buf.toString('utf8', spos + off, spos + off + u8len));
    } else {
      let u16len = buf.readUInt16LE(spos);
      let off = 2;
      if (u16len & 0x8000) off += 2;
      strings.push(buf.toString('utf16le', spos + off, spos + off + u16len * 2));
    }
  }

  pos += chunkSize;

  if (pos < buf.length && buf.readUInt16LE(pos) === 0x0180) {
    const resChunkSize = buf.readUInt32LE(pos + 4);
    pos += resChunkSize;
  }

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  let indent = 0;
  const pad = () => '    '.repeat(indent);

  const namespaces = {};

  while (pos < buf.length) {
    const type = buf.readUInt16LE(pos);
    const size = buf.readUInt32LE(pos + 4);
    if (size === 0) break;

    if (type === 0x0100) { // START_NAMESPACE
      const prefixIdx = buf.readInt32LE(pos + 16);
      const uriIdx = buf.readInt32LE(pos + 20);
      const prefix = prefixIdx >= 0 ? strings[prefixIdx] : '';
      const uri = uriIdx >= 0 ? strings[uriIdx] : '';
      namespaces[uri] = prefix;
    } else if (type === 0x0101) { // END_NAMESPACE
      // end ns
    } else if (type === 0x0102) { // START_TAG
      const nameIdx = buf.readInt32LE(pos + 16 + 4);
      const attrStart = buf.readUInt16LE(pos + 16 + 8);
      const attrSize = buf.readUInt16LE(pos + 16 + 10);
      const attrCount = buf.readUInt16LE(pos + 16 + 12);
      const name = strings[nameIdx];

      let tagStr = pad() + '<' + name;
      if (indent === 0) {
        for (const [uri, prefix] of Object.entries(namespaces)) {
          tagStr += ' xmlns:' + prefix + '="' + uri + '"';
        }
      }

      for (let i = 0; i < attrCount; i++) {
        const aPos = pos + 16 + attrStart + i * attrSize;
        const aNsIdx = buf.readInt32LE(aPos);
        const aNameIdx = buf.readInt32LE(aPos + 4);
        const aRawValIdx = buf.readInt32LE(aPos + 8);
        const aValType = buf.readUInt8(aPos + 15);
        const aValData = buf.readUInt32LE(aPos + 16);

        const aNs = (aNsIdx >= 0 && strings[aNsIdx] && namespaces[strings[aNsIdx]]) ? namespaces[strings[aNsIdx]] + ':' : '';
        const aName = strings[aNameIdx];
        let val = '';
        if (aRawValIdx >= 0) {
          val = strings[aRawValIdx];
        } else if (aValType === 3) { // string
          val = strings[aValData];
        } else if (aValType === 18) { // boolean
          val = aValData !== 0 ? 'true' : 'false';
        } else if (aValType === 1) { // reference
          val = '@0x' + aValData.toString(16);
        } else if (aValType === 16) { // int
          val = aValData.toString();
        } else if (aValType === 17) { // hex
          val = '0x' + aValData.toString(16);
        } else {
          val = aValData.toString();
        }
        tagStr += '\n' + pad() + '    ' + aNs + aName + '="' + (val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
      }
      tagStr += '>';
      xml += tagStr + '\n';
      indent++;
    } else if (type === 0x0103) { // END_TAG
      indent = Math.max(0, indent - 1);
      const nameIdx = buf.readInt32LE(pos + 16 + 4);
      xml += pad() + '</' + strings[nameIdx] + '>\n';
    } else if (type === 0x0104) { // CDATA
      const dataIdx = buf.readInt32LE(pos + 16);
      if (dataIdx >= 0) xml += pad() + strings[dataIdx] + '\n';
    }
    pos += size;
  }
  return xml;
}

const inputPath = 'D:/A.I Project/A.I Project - vBooks/vBooks/AndroidManifest.xml';
const outputPath = 'D:/A.I Project/A.I Project - vBooks/vBooks/AndroidManifest_decoded.xml';
const buf = fs.readFileSync(inputPath);
const decoded = decodeAxml(buf);
fs.writeFileSync(outputPath, decoded, 'utf8');
console.log('Successfully decoded AndroidManifest.xml -> ' + outputPath);
