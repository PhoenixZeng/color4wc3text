import * as assert from "assert";
import { decodeWar3Text, findWar3TextSpan } from "../../main/war3-text-range.js";

suite("War3 按语言确定正文边界", () => {
  const color = "|cFFFF0000文字";
  const cases: { name: string; language: string; source: string; expected?: string; fileName?: string }[] = [
    { name: "Lua 双引号", language: "lua", source: `local x = "§${color}" -- 注释`, expected: color },
    { name: "Lua 单引号", language: "lua", source: `local x = '§${color}'`, expected: color },
    { name: "Lua 多行长括号", language: "lua", source: `x = [[\n前文\n§${color}\n尾文]]`, expected: `前文\n${color}\n尾文` },
    { name: "Lua 长括号等级", language: "lua", source: `x = [==[前]]文§${color}]=]尾]==]`, expected: `前]]文${color}]=]尾` },
    { name: "Lua 短注释", language: "lua", source: `-- x = "§${color}"` },
    { name: "Lua 长注释", language: "lua", source: `--[=[\nx="§${color}"\n]=]` },
    { name: "Lua 注释后的字符串", language: "lua", source: `--[["假"]]\nx="§${color}"`, expected: color },
    { name: "Lua 未闭合长字符串", language: "lua", source: `x=[=[§${color}]]` },
    { name: "Lua 短字符串不跨裸换行", language: "lua", source: `x="§${color}\n"` },
    { name: "JASS 双引号", language: "jass", source: `set x = "§${color}"`, expected: color },
    { name: "vJASS 双引号", language: "vjass", source: `set x = "§${color}"`, expected: color },
    { name: "Zinc 双引号", language: "zinc", source: `x = "§${color}";`, expected: color },
    { name: "JASS 单引号不是字符串", language: "jass", source: `x='§${color}'` },
    { name: "JASS 行注释", language: "jass", source: `// "§${color}"` },
    { name: "Zinc 块注释", language: "zinc", source: `/* "§${color}" */` },
    { name: "FDF 双引号", language: "fdf", source: `Text "§${color}",`, expected: color },
    { name: "FDF 注释", language: "fdf", source: `// Text "§${color}"` },
    { name: "INI 无引号赋值", language: "ini", source: `name = §${color} 尾文  ; 注释`, expected: `${color} 尾文` },
    { name: "INI 引号中的注释符", language: "ini", source: `name = "§${color} ; # --"`, expected: `${color} ; # --` },
    { name: "INI 键不预览", language: "ini", source: `"§${color}" = "value"` },
    { name: "INI 节名不预览", language: "ini", source: `[§${color}]` },
    { name: "INI 注释不预览", language: "ini", source: `; name = §${color}` },
    { name: "INI 等号后跨行长字符串", language: "ini", source: `name =\n[=[\n§${color}\n尾文]=]`, expected: `${color}\n尾文` },
    { name: "LNI 表中字符串", language: "lni", source: `[unit]\nTip = {"其他",\n'§${color}',}\nName="别的"`, expected: color },
    { name: "LNI 嵌套字段", language: "lni", source: `a = { title = "§${color}", n = 1 }`, expected: color },
    { name: "LNI 表键不是正文", language: "lni", source: `a = { "§${color}" = "值" }` },
    { name: "LNI 无引号值", language: "lni", source: `name = §${color} 尾文 -- 注释`, expected: `${color} 尾文` },
    { name: "LNI 通过后缀识别", language: "plaintext", fileName: "unit.lni", source: `name = "§${color}"`, expected: color },
    { name: "XML 多行文本节点", language: "xml", source: `<root>\n§${color}\n尾文</root>`, expected: `\n${color}\n尾文` },
    { name: "XML 双引号属性", language: "xml", source: `<root text="§${color}"/>`, expected: color },
    { name: "XML 单引号属性", language: "xml", source: `<root text='§${color}'/>`, expected: color },
    { name: "XML 属性中的大于号", language: "xml", source: `<root text=">§${color}"/>`, expected: `>${color}` },
    { name: "XML 文本中的引号不截断节点", language: "xml", source: `<root>前"§${color}"后</root>`, expected: `前"${color}"后` },
    { name: "XML 相邻子节点不合并", language: "xml", source: `<root><a>§${color}</a><b>另段</b></root>`, expected: color },
    { name: "XML 注释", language: "xml", source: `<root><!-- §${color} --></root>` },
    { name: "XML CDATA", language: "xml", source: `<root><![CDATA[§${color}<原文>]]></root>`, expected: `${color}<原文>` },
    { name: "XML 处理指令", language: "xml", source: `<?x a="§${color}"?><root/>` },
    { name: "XML 无引号属性拒绝", language: "xml", source: `<root a=§${color}/>` },
    { name: "JSON 字符串值", language: "json", source: `{"x":"§${color}"}`, expected: color },
    { name: "JSON 数组字符串", language: "json", source: `["§${color}","另段"]`, expected: color },
    { name: "JSON 键不预览", language: "json", source: `{"§${color}":"x"}` },
    { name: "JSON 非法单引号", language: "json", source: `{'x':'§${color}'}` },
    { name: "JS 双引号", language: "javascript", source: `let x = "§${color}";`, expected: color },
    { name: "TS 单引号", language: "typescript", source: `let x: string = '§${color}';`, expected: color },
    { name: "JS 静态模板", language: "javascript", source: 'const x = `前\n§'+color+'后`;', expected: `前\n${color}后` },
    { name: "JS 动态模板不猜测", language: "javascript", source: 'const x = `§'+color+'${name}`;' },
    { name: "JS 正则中的引号", language: "javascript", source: `const re = /"§${color}"/;` },
    { name: "JS 控制语句后正则不误识别", language: "javascript", source: `if (ok) /"§${color}"/.test(x);` },
    { name: "JS 注释", language: "javascript", source: `/* '§${color}' */` },
    { name: "LNI 未闭合列表拒绝", language: "lni", source: `a = {"§${color}"` },
    { name: "INI 引号后非法尾部拒绝", language: "ini", source: `a = "§${color}" garbage` },
    { name: "INI 键后的注释不作为赋值", language: "ini", source: `a -- x = "§${color}"` },
    { name: "Lua 长注释未闭合", language: "lua", source: `--[=[ x="§${color}"` },
    { name: "XML 未闭合属性拒绝", language: "xml", source: `<root a="§${color}` },
    { name: "XML DTD 声明排除", language: "xml", source: `<!DOCTYPE root [<!ENTITY a "§${color}">]><root/>` },
    { name: "JS 嵌套动态模板内不预览", language: "javascript", source: 'let x = `outer ${`nested §'+color+'`}`;' },
    { name: "JS 动态模板之后的独立字符串", language: "javascript", source: 'let x = `outer ${`nested`}`; let y = "§'+color+'";', expected: color },
    { name: "不支持语言不回退", language: "plaintext", source: `"§${color}"` },
    { name: "裸文本不回退整行", language: "lua", source: `§${color}` },
  ];
  for (const entry of cases) {
    test(entry.name, () => {
      const offset = entry.source.indexOf("§");
      const source = entry.source.replace("§", "");
      const span = findWar3TextSpan(source, offset, entry.language, entry.fileName);
      assert.strictEqual(span ? source.slice(span.start, span.end) : undefined, entry.expected);
    });
  }
});


suite("War3 预览语言转义", () => {
  const cases = [
    { language: "lua", source: String.raw`x="|cFFFF0000前\"引号\n后\t文\\尾"`, expected: '|cFFFF0000前"引号\n后\t文\\尾' },
    { language: "lua", source: String.raw`x="|cFFFF0000\65\x42\u{4e2d}\z  文"`, expected: '|cFFFF0000AB中文' },
    { language: "lua", source: String.raw`x=[[|cFFFF0000\n\"原文]]`, expected: String.raw`|cFFFF0000\n\"原文` },
    { language: "jass", source: String.raw`set x="|cFFFF0000\"正文\"\n尾"`, expected: '|cFFFF0000"正文"\n尾' },
    { language: "json", source: String.raw`{"x":"|cFFFF0000\u4e2d\n\"文\""}`, expected: '|cFFFF0000中\n"文"' },
    { language: "javascript", source: String.raw`const x="|cFFFF0000\u4e2d\x41\u{1f600}"`, expected: '|cFFFF0000中A😀' },
    { language: "xml", source: '<a text="|cFFFF0000&quot;&amp;lt;&#x4e2d;&#25991;"/>', expected: '|cFFFF0000"&lt;中文' },
    { language: "xml", source: '<a><![CDATA[|cFFFF0000&quot;\\n]]></a>', expected: '|cFFFF0000&quot;\\n' },
    { language: "ini", source: String.raw`name=|cFFFF0000C:\new\test`, expected: String.raw`|cFFFF0000C:\new\test` },
    { language: "lni", source: String.raw`name="|cFFFF0000前\"后"`, expected: '|cFFFF0000前"后' },
  ];
  for (const [index, item] of cases.entries()) {
    test(`${item.language} 解码案例 ${index + 1}`, () => {
      const span = findWar3TextSpan(item.source, item.source.indexOf('|c') + 2, item.language);
      assert.ok(span);
      assert.strictEqual(decodeWar3Text(item.source, span, item.language), item.expected);
    });
  }
});
