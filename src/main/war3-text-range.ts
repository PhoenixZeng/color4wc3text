/** 源码中的正文偏移，不包含引号、长括号或 XML 标记。 */
export interface TextSpan { start: number; end: number; encoding?: "quoted" | "raw" | "xml" }
interface Literal extends TextSpan { next: number }
const contains = (span: TextSpan, offset: number): boolean => span.start <= offset && offset < span.end;
const lineEnd = (text: string, start: number): number => {
  const end = text.indexOf("\n", start);
  return end < 0 ? text.length : end;
};

function quoted(text: string, start: number, escape = true, multiline = false, lua = false): Literal | undefined {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === quote) { return { start: start + 1, end: i, next: i + 1, encoding: escape ? "quoted" : "xml" }; }
    if (escape && text[i] === "\\") {
      if (lua && text[i + 1] === "z") {
        i += 2;
        while (/\s/.test(text[i] ?? "") && i < text.length) { i++; }
        i--;
      } else {
        if (text[i + 1] === "\r" && text[i + 2] === "\n") { i++; }
        i++;
      }
    } else if (!multiline && /[\r\n]/.test(text[i])) { return; }
  }
  return;
}

function longString(text: string, start: number): Literal | undefined {
  const opening = /^\[(=*)\[/.exec(text.slice(start));
  if (!opening) { return; }
  const close = `]${opening[1]}]`;
  let body = start + opening[0].length;
  const end = text.indexOf(close, body);
  if (end < 0) { return; }
  if (text[body] === "\r" && text[body + 1] === "\n") { body += 2; }
  else if (text[body] === "\n" || text[body] === "\r") { body++; }
  return { start: body, end, next: end + close.length, encoding: "raw" };
}

/** 跳过模板中的表达式和嵌套模板，不把表达式内引号当作模板边界。 */
function templateLiteral(text: string, start: number): (Literal & { dynamic: boolean }) | undefined {
  let dynamic = false;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") { i++; continue; }
    if (text[i] === "`") { return { start: start + 1, end: i, next: i + 1, dynamic, encoding: "quoted" }; }
    if (!text.startsWith("${", i)) { continue; }
    dynamic = true;
    let depth = 1;
    i += 2;
    for (; i < text.length && depth; i++) {
      if (text.startsWith("//", i)) { i = lineEnd(text, i); continue; }
      if (text.startsWith("/*", i)) {
        const end = text.indexOf("*/", i + 2);
        if (end < 0) { return; }
        i = end + 1; continue;
      }
      if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
        const inner = text[i] === "`" ? templateLiteral(text, i) : quoted(text, i);
        if (!inner) { return; }
        i = inner.next - 1; continue;
      }
      if (text[i] === "{") { depth++; }
      if (text[i] === "}") { depth--; }
    }
    if (depth) { return; }
    i--;
  }
  return;
}

function scriptSpan(text: string, offset: number, language: string): TextSpan | undefined {
  const lua = language === "lua";
  const js = ["javascript", "typescript", "js"].includes(language);
  for (let i = 0; i <= offset && i < text.length;) {
    if (lua && text.startsWith("--", i)) {
      const comment = longString(text, i + 2);
      if (/^\[(=*)\[/.test(text.slice(i + 2))) {
        if (!comment) { return; }
        i = comment.next;
      } else { i = lineEnd(text, i); }
      continue;
    }
    if (!lua && text.startsWith("//", i)) { i = lineEnd(text, i); continue; }
    if (!lua && text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) { return; }
      i = end + 2; continue;
    }
    if (lua && /^\[(=*)\[/.test(text.slice(i))) {
      const literal = longString(text, i);
      if (!literal) { return; }
      if (contains(literal, offset)) { return literal; }
      i = literal.next; continue;
    }
    if (js && text[i] === "/") {
      // 有完整 /.../ 边界时保守跳过；不猜测歧义除法表达式中的引号。
      let j = i + 1;
      let inClass = false;
      for (; j < text.length && !/[\r\n]/.test(text[j]); j++) {
        if (text[j] === "\\") { j++; continue; }
        if (text[j] === "[") { inClass = true; }
        if (text[j] === "]") { inClass = false; }
        if (text[j] === "/" && !inClass) { break; }
      }
      if (text[j] === "/") { i = j + 1; continue; }
    }
    if (text[i] === '"' || text[i] === "'" || (js && text[i] === "`")) {
      const quote = text[i];
      const literal = quote === "`" ? templateLiteral(text, i) : quoted(text, i, true, false, lua);
      if (!literal) { return; }
      const allowed = quote === '"' || lua || js;
      // 含插值的模板并非单个确定字符串，不拼接、求值或猜测其边界。
      const dynamic = "dynamic" in literal && literal.dynamic;
      if (contains(literal, offset)) { return allowed && !dynamic ? literal : undefined; }
      i = literal.next; continue;
    }
    i++;
  }
  return;
}

function jsonSpan(text: string, offset: number): TextSpan | undefined {
  try { JSON.parse(text); } catch { return; }
  for (let i = 0; i <= offset && i < text.length; i++) {
    if (text[i] !== '"') { continue; }
    const literal = quoted(text, i);
    if (!literal) { return; }
    if (contains(literal, offset)) {
      // 对象键不是显示文字；只接受字符串值。
      return text.slice(literal.next).trimStart().startsWith(":") ? undefined : literal;
    }
    i = literal.next - 1;
  }
  return;
}

function xmlSpan(text: string, offset: number): TextSpan | undefined {
  const elements: string[] = [];
  for (let i = 0; i < text.length && i <= offset;) {
    if (text.startsWith("<!--", i) || text.startsWith("<?", i)) {
      const close = text.startsWith("<!--", i) ? "-->" : "?>";
      const end = text.indexOf(close, i + close.length);
      if (end < 0 || offset < end + close.length) { return; }
      i = end + close.length; continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end < 0) { return; }
      const span: TextSpan = { start: i + 9, end, encoding: "raw" };
      if (contains(span, offset)) { return elements.length ? span : undefined; }
      i = end + 3; continue;
    }
    if (text.startsWith("<!", i)) {
      // DOCTYPE 内部可能包含 >、引号和子集，整体跳过。
      let depth = 0;
      let j = i + 2;
      for (; j < text.length; j++) {
        if (text[j] === '"' || text[j] === "'") {
          const value = quoted(text, j, false, true);
          if (!value) { return; }
          j = value.next - 1;
        } else if (text[j] === "[") { depth++; }
        else if (text[j] === "]") { depth--; }
        else if (text[j] === ">" && depth === 0) { break; }
      }
      if (offset <= j) { return; }
      i = j + 1; continue;
    }
    if (text[i] === "<") {
      const tag = /^<\/?([\w:.-]+)/.exec(text.slice(i));
      if (!tag) { return; }
      const closing = text[i + 1] === "/";
      let j = i + tag[0].length;
      let target: TextSpan | undefined;
      while (j < text.length && text[j] !== ">") {
        if (/\s/.test(text[j]) || text[j] === "/") { j++; continue; }
        const attribute = /^[\w:.-]+\s*=\s*/.exec(text.slice(j));
        if (!attribute || closing) { return; }
        j += attribute[0].length;
        if (text[j] !== '"' && text[j] !== "'") { return; }
        const literal = quoted(text, j, false, true);
        if (!literal || text.slice(literal.start, literal.end).includes("<")) { return; }
        if (contains(literal, offset)) { target = literal; }
        j = literal.next;
      }
      if (j === text.length) { return; }
      if (target) { return target; }
      if (closing) {
        if (elements.pop() !== tag[1]) { return; }
      } else if (text[j - 1] !== "/") { elements.push(tag[1]); }
      i = j + 1; continue;
    }
    const end = text.indexOf("<", i);
    if (end < 0) { return; }
    const span: TextSpan = { start: i, end, encoding: "xml" };
    if (contains(span, offset)) { return elements.length ? span : undefined; }
    i = end;
  }
  return;
}

function iniSpan(text: string, offset: number, strictLni: boolean): TextSpan | undefined {
  let found: TextSpan | undefined;
  let valid = true;
  const skip = (start: number): number => {
    let i = start;
    while (i < text.length) {
      if (/\s/.test(text[i])) { i++; }
      else if (text.startsWith("--", i) || text[i] === ";" || text[i] === "#") { i = lineEnd(text, i); }
      else { break; }
    }
    return i;
  };
  const accept = (span: TextSpan): void => { if (contains(span, offset)) { found = span; } };
  const value = (start: number, table = false): number => {
    let i = skip(start);
    if (text[i] === '"' || text[i] === "'") {
      const literal = quoted(text, i);
      if (!literal) { valid = false; return text.length; }
      const after = skip(literal.next);
      if (table && text[after] === "=") { return value(after + 1, true); }
      if (table && text[after] !== "," && text[after] !== "}") { valid = false; }
      accept(literal); return literal.next;
    }
    if (/^\[(=*)\[/.test(text.slice(i))) {
      const literal = longString(text, i);
      if (!literal) { valid = false; return text.length; }
      accept(literal); return literal.next;
    }
    if (text[i] === "{") {
      i++;
      while ((i = skip(i)) < text.length && text[i] !== "}") {
        if (text[i] === ",") { i++; continue; }
        const next = value(i, true);
        if (next <= i) { return text.length; }
        i = next;
      }
      if (text[i] !== "}") { valid = false; }
      return i + 1;
    }
    const begin = i;
    while (i < text.length && !/[\r\n]/.test(text[i])) {
      if (text.startsWith("--", i) || (!strictLni && /[;#]/.test(text[i]) && (i === begin || /\s/.test(text[i - 1])))) { break; }
      if (table && /[,}=\s]/.test(text[i])) { break; }
      i++;
    }
    let end = i;
    while (end > begin && /\s/.test(text[end - 1])) { end--; }
    if (table && text[skip(i)] === "=") { return value(skip(i) + 1, true); }
    accept({ start: begin, end });
    return i;
  };
  for (let i = skip(0); i < text.length && i <= offset; i = skip(i)) {
    if (text[i] === "[" || text[i] === "<") { i = lineEnd(text, i); continue; }
    // 键名允许引号，但不把键名作为预览正文。
    if (text[i] === '"' || text[i] === "'") {
      const key = quoted(text, i);
      if (!key) { return; }
      i = key.next;
    }
    while (i < text.length && !/[=\r\n]/.test(text[i])) {
      if (text.startsWith("--", i) || text[i] === ";" || text[i] === "#") { i = lineEnd(text, i); break; }
      i++;
    }
    if (text[i] !== "=") { i = lineEnd(text, i) + 1; continue; }
    i = value(i + 1);
    const tail = text.slice(i, lineEnd(text, i)).trim();
    if (!valid || (tail && !/^(--|;|#)/.test(tail))) { return; }
    if (found) { return found; }
    i = lineEnd(text, i) + 1;
  }
  return;
}

/** 未识别语言、注释、未闭合结构都不退回整行猜测。 */
export function findWar3TextSpan(text: string, offset: number, language: string, fileName = ""): TextSpan | undefined {
  if (language === "lni" || /\.lni$/i.test(fileName)) { return iniSpan(text, offset, true); }
  if (language === "ini") { return iniSpan(text, offset, false); }
  if (language === "xml") { return xmlSpan(text, offset); }
  if (language === "json") { return jsonSpan(text, offset); }
  if (["lua", "jass", "vjass", "zinc", "fdf", "javascript", "typescript", "js"].includes(language)) {
    return scriptSpan(text, offset, language);
  }
  return;
}


/** 只解码确定的字面量，不执行源码；原始范围始终用于编辑。 */
export function decodeWar3Text(text: string, span: TextSpan, language: string): string {
  const body = text.slice(span.start, span.end);
  if (span.encoding === "xml") {
    const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    return body.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (original, entity: string) => {
      if (!entity.startsWith("#")) { return entities[entity]; }
      const value = entity[1] === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : original;
    });
  }
  if (span.encoding !== "quoted") { return body; }
  if (language === "json") { return JSON.parse(`"${body}"`) as string; }
  const lua = ["lua", "ini", "lni"].includes(language);
  const js = ["javascript", "typescript", "js"].includes(language);
  const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", '\\': '\\', '"': '"', "'": "'" };
  if (lua) { simple.a = "\x07"; simple.v = "\v"; }
  if (js) { simple.v = "\v"; simple['0'] = "\0"; simple['`'] = "`"; simple['$'] = "$"; }
  return body.replace(/\\(\r\n|[\r\n]|z\s*|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\d{1,3}|[\s\S])/g, (original, escape: string) => {
    if (escape in simple) { return simple[escape]; }
    if (/^[\r\n]/.test(escape)) { return js ? "" : lua ? "\n" : original; }
    if (lua && escape.startsWith("z")) { return ""; }
    if ((lua || js) && /^x[\da-f]{2}$/i.test(escape)) { return String.fromCharCode(parseInt(escape.slice(1), 16)); }
    if ((lua || js) && /^u\{[\da-f]+\}$/i.test(escape)) {
      const value = parseInt(escape.slice(2, -1), 16);
      return value <= 0x10ffff ? String.fromCodePoint(value) : original;
    }
    if (js && /^u[\da-f]{4}$/i.test(escape)) { return String.fromCharCode(parseInt(escape.slice(1), 16)); }
    if (lua && /^\d{1,3}$/.test(escape) && Number(escape) <= 255) { return String.fromCharCode(Number(escape)); }
    return original;
  });
}
