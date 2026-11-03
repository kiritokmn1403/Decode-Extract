const fs = require('fs');
const path = require('path');

const buf = fs.readFileSync('D:/A.I Project/A.I Project - vBooks/vBooks/classes3.dex');

// 1. Strings
const stringIdsSize = buf.readUInt32LE(0x38);
const stringIdsOff = buf.readUInt32LE(0x3c);
const strings = [];
for (let i = 0; i < stringIdsSize; i++) {
  const off = buf.readUInt32LE(stringIdsOff + i * 4);
  let pos = off;
  let len = 0, shift = 0;
  while (true) {
    let b = buf[pos++];
    len |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  let end = pos;
  while (buf[end] !== 0) end++;
  strings.push(buf.toString('utf8', pos, end));
}

// 2. Types
const typeIdsSize = buf.readUInt32LE(0x40);
const typeIdsOff = buf.readUInt32LE(0x44);
const types = [];
for (let i = 0; i < typeIdsSize; i++) {
  types.push(strings[buf.readUInt32LE(typeIdsOff + i * 4)]);
}

// 3. Protos
const protoIdsSize = buf.readUInt32LE(0x48);
const protoIdsOff = buf.readUInt32LE(0x4c);
const protos = [];
for (let i = 0; i < protoIdsSize; i++) {
  const pOff = protoIdsOff + i * 12;
  const returnTypeIdx = buf.readUInt32LE(pOff + 4);
  const paramsOff = buf.readUInt32LE(pOff + 8);
  const paramTypes = [];
  if (paramsOff !== 0) {
    const size = buf.readUInt32LE(paramsOff);
    for (let j = 0; j < size; j++) {
      paramTypes.push(types[buf.readUInt16LE(paramsOff + 4 + j * 2)]);
    }
  }
  protos.push({ returnType: types[returnTypeIdx], paramTypes });
}

// 4. Fields
const fieldIdsSize = buf.readUInt32LE(0x50);
const fieldIdsOff = buf.readUInt32LE(0x54);
const fields = [];
for (let i = 0; i < fieldIdsSize; i++) {
  const fOff = fieldIdsOff + i * 8;
  const classIdx = buf.readUInt16LE(fOff);
  const typeIdx = buf.readUInt16LE(fOff + 2);
  const nameIdx = buf.readUInt32LE(fOff + 4);
  fields.push({ className: types[classIdx], typeName: types[typeIdx], name: strings[nameIdx] });
}

// 5. Methods
const methodIdsSize = buf.readUInt32LE(0x58);
const methodIdsOff = buf.readUInt32LE(0x5c);
const methods = [];
for (let i = 0; i < methodIdsSize; i++) {
  const mOff = methodIdsOff + i * 8;
  const classIdx = buf.readUInt16LE(mOff);
  const protoIdx = buf.readUInt16LE(mOff + 2);
  const nameIdx = buf.readUInt32LE(mOff + 4);
  methods.push({ className: types[classIdx], proto: protos[protoIdx], name: strings[nameIdx] });
}

function readUleb128(b, pos) {
  let val = 0, shift = 0, count = 0;
  while (true) {
    let byte = b[pos++];
    count++;
    val |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) break;
    shift += 7;
  }
  return { val, bytes: count };
}

function formatType(dexType) {
  if (!dexType) return 'void';
  if (dexType.startsWith('[')) {
    return formatType(dexType.substring(1)) + '[]';
  }
  switch (dexType) {
    case 'V': return 'void';
    case 'Z': return 'boolean';
    case 'B': return 'byte';
    case 'S': return 'short';
    case 'C': return 'char';
    case 'I': return 'int';
    case 'J': return 'long';
    case 'F': return 'float';
    case 'D': return 'double';
  }
  if (dexType.startsWith('L') && dexType.endsWith(';')) {
    return dexType.substring(1, dexType.length - 1).replace(/\//g, '.');
  }
  return dexType;
}

function getAccessModifiers(flags, isClass = false) {
  const mods = [];
  if (flags & 0x0001) mods.push('public');
  if (flags & 0x0002) mods.push('private');
  if (flags & 0x0004) mods.push('protected');
  if (flags & 0x0008) mods.push('static');
  if (flags & 0x0010) mods.push('final');
  if (flags & 0x0020) mods.push(isClass ? 'synchronized' : 'synchronized');
  if (flags & 0x0040) mods.push('volatile');
  if (flags & 0x0080) mods.push('transient');
  if (flags & 0x0100) mods.push('native');
  if (flags & 0x0400) mods.push('abstract');
  return mods.join(' ');
}

const outBase = 'D:/A.I Project/A.I Project - vBooks/vBooks/src/main/java';
let writtenCount = 0;

const classDefsSize = buf.readUInt32LE(0x60);
const classDefsOff = buf.readUInt32LE(0x64);

for (let i = 0; i < classDefsSize; i++) {
  const cOff = classDefsOff + i * 32;
  const classIdx = buf.readUInt32LE(cOff);
  const cDexName = types[classIdx];

  // Only decompile com.vbook classes
  if (!cDexName.startsWith('Lcom/vbook/')) continue;

  const accessFlags = buf.readUInt32LE(cOff + 4);
  const superclassIdx = buf.readUInt32LE(cOff + 8);
  const superclass = superclassIdx !== 0xffffffff ? types[superclassIdx] : null;
  const interfacesOff = buf.readUInt32LE(cOff + 12);
  const sourceFileIdx = buf.readUInt32LE(cOff + 16);
  const sourceFile = sourceFileIdx !== 0xffffffff ? strings[sourceFileIdx] : null;
  const classDataOff = buf.readUInt32LE(cOff + 24);

  const ifaces = [];
  if (interfacesOff !== 0) {
    const iSize = buf.readUInt32LE(interfacesOff);
    for (let j = 0; j < iSize; j++) {
      ifaces.push(types[buf.readUInt16LE(interfacesOff + 4 + j * 2)]);
    }
  }

  const cleanFullName = cDexName.substring(1, cDexName.length - 1);
  const pkgParts = cleanFullName.split('/');
  const rawClassName = pkgParts.pop();
  const pkgName = pkgParts.join('.');

  let isInterface = (accessFlags & 0x0200) !== 0;
  let isEnum = (accessFlags & 0x4000) !== 0;
  let isAnnotation = (accessFlags & 0x2000) !== 0;

  let classKeyword = 'class';
  if (isInterface) classKeyword = 'interface';
  if (isAnnotation) classKeyword = '@interface';
  if (isEnum) classKeyword = 'enum';

  let mods = getAccessModifiers(accessFlags, true);
  if (mods) mods += ' ';

  let header = `${mods}${classKeyword} ${rawClassName}`;
  if (superclass && superclass !== 'Ljava/lang/Object;' && !isInterface && !isEnum) {
    header += ` extends ${formatType(superclass)}`;
  }
  if (ifaces.length > 0) {
    header += ` implements ${ifaces.map(formatType).join(', ')}`;
  }

  const sFieldList = [];
  const iFieldList = [];
  const dMethodList = [];
  const vMethodList = [];

  if (classDataOff !== 0) {
    let p = classDataOff;
    let r = readUleb128(buf, p); p += r.bytes; const sFields = r.val;
    r = readUleb128(buf, p); p += r.bytes; const iFields = r.val;
    r = readUleb128(buf, p); p += r.bytes; const dMethods = r.val;
    r = readUleb128(buf, p); p += r.bytes; const vMethods = r.val;

    let lastF = 0;
    for (let f = 0; f < sFields; f++) {
      r = readUleb128(buf, p); p += r.bytes; lastF += r.val;
      r = readUleb128(buf, p); p += r.bytes; const fFlags = r.val;
      const fItem = fields[lastF];
      sFieldList.push({ name: fItem.name, type: formatType(fItem.typeName), mods: getAccessModifiers(fFlags) });
    }
    for (let f = 0; f < iFields; f++) {
      r = readUleb128(buf, p); p += r.bytes; lastF += r.val;
      r = readUleb128(buf, p); p += r.bytes; const fFlags = r.val;
      const fItem = fields[lastF];
      iFieldList.push({ name: fItem.name, type: formatType(fItem.typeName), mods: getAccessModifiers(fFlags) });
    }

    let lastM = 0;
    for (let m = 0; m < dMethods; m++) {
      r = readUleb128(buf, p); p += r.bytes; lastM += r.val;
      r = readUleb128(buf, p); p += r.bytes; const mFlags = r.val;
      r = readUleb128(buf, p); p += r.bytes; const codeOff = r.val;
      const mItem = methods[lastM];
      dMethodList.push({
        name: mItem.name,
        returnType: formatType(mItem.proto.returnType),
        params: mItem.proto.paramTypes.map(formatType),
        mods: getAccessModifiers(mFlags),
        hasCode: codeOff !== 0
      });
    }
    for (let m = 0; m < vMethods; m++) {
      r = readUleb128(buf, p); p += r.bytes; lastM += r.val;
      r = readUleb128(buf, p); p += r.bytes; const mFlags = r.val;
      r = readUleb128(buf, p); p += r.bytes; const codeOff = r.val;
      const mItem = methods[lastM];
      vMethodList.push({
        name: mItem.name,
        returnType: formatType(mItem.proto.returnType),
        params: mItem.proto.paramTypes.map(formatType),
        mods: getAccessModifiers(mFlags),
        hasCode: codeOff !== 0
      });
    }
  }

  let code = `package ${pkgName};\n\n`;
  if (sourceFile) {
    code += `// Compiled from ${sourceFile}\n`;
  }
  code += `${header} {\n`;

  // Static fields
  if (sFieldList.length > 0) {
    code += `    // Static fields\n`;
    for (const f of sFieldList) {
      code += `    ${f.mods ? f.mods + ' ' : ''}${f.type} ${f.name};\n`;
    }
    code += `\n`;
  }

  // Instance fields
  if (iFieldList.length > 0) {
    code += `    // Instance fields\n`;
    for (const f of iFieldList) {
      code += `    ${f.mods ? f.mods + ' ' : ''}${f.type} ${f.name};\n`;
    }
    code += `\n`;
  }

  // Direct methods / Constructors
  if (dMethodList.length > 0) {
    code += `    // Constructors & Direct methods\n`;
    for (const m of dMethodList) {
      let isInit = m.name === '<init>';
      let isClinit = m.name === '<clinit>';
      let paramStr = m.params.map((p, idx) => `${p} p${idx}`).join(', ');
      if (isInit) {
        code += `    ${m.mods ? m.mods + ' ' : ''}${rawClassName.split('$').pop()}(${paramStr}) {\n    }\n\n`;
      } else if (isClinit) {
        code += `    static {\n    }\n\n`;
      } else {
        code += `    ${m.mods ? m.mods + ' ' : ''}${m.returnType} ${m.name}(${paramStr}) {\n    }\n\n`;
      }
    }
  }

  // Virtual methods
  if (vMethodList.length > 0) {
    code += `    // Virtual methods\n`;
    for (const m of vMethodList) {
      let paramStr = m.params.map((p, idx) => `${p} p${idx}`).join(', ');
      code += `    ${m.mods ? m.mods + ' ' : ''}${m.returnType} ${m.name}(${paramStr}) {\n    }\n\n`;
    }
  }

  code += `}\n`;

  const targetDir = path.join(outBase, pkgParts.join('/'));
  fs.mkdirSync(targetDir, { recursive: true });
  const safeFileName = rawClassName.replace(/[^a-zA-Z0-9_$]/g, '_') + '.java';
  fs.writeFileSync(path.join(targetDir, safeFileName), code, 'utf8');
  writtenCount++;
}

console.log(`Successfully generated ${writtenCount} Java classes in ${outBase}`);
