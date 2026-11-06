import * as vscode from "vscode";

// ============================================================
// 通用工具
// ============================================================

/** 将数值限制在指定范围内。 */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** 将 VS Code 颜色分量（0~1）转换为 0~255 整数。 */
const toByte = (value: number): number => clamp(Math.round(value * 255), 0, 255);

/** 转换为固定两位十六进制。 */
const toHexByte = (value: number): string =>
  toByte(value).toString(16).padStart(2, "0").toUpperCase();

/** 根据目标颜色代码及当前资源设置决定 HEX 大小写。 */
const formatHexCase = (hex: string, originalHex: string, document: vscode.TextDocument): string => {
  const mode = vscode.workspace.getConfiguration("color4wc3text", document.uri).get<string>("hexCase", "auto");
  const firstLetter = originalHex.match(/[a-fA-F]/)?.[0];
  const lowercase = mode === "lowercase" || (mode === "auto" && firstLetter !== undefined && firstLetter === firstLetter.toLowerCase());
  return lowercase ? hex.toLowerCase() : hex.toUpperCase();
};

/** 转换为十进制颜色分量。 */
const toDecByte = (value: number): string => toByte(value).toString(10);

/** CSS HEX：RRGGBB。 */
const colorToCssHex = (color: vscode.Color): string =>
  [toHexByte(color.red), toHexByte(color.green), toHexByte(color.blue)].join("");

/** War3 HEX：AARRGGBB。 */
const colorToWar3Hex = (color: vscode.Color): string =>
  [
    toHexByte(color.alpha),
    toHexByte(color.red),
    toHexByte(color.green),
    toHexByte(color.blue),
  ].join("");

/** color(r, g, b, a)：分量均为 0~255。 */
const colorToFourComponents = (color: vscode.Color): string =>
  [
    toDecByte(color.red),
    toDecByte(color.green),
    toDecByte(color.blue),
    toDecByte(color.alpha),
  ].join(", ");

/** color(r, g, b) / rgb(r, g, b)。 */
const colorToThreeComponents = (color: vscode.Color): string =>
  [toDecByte(color.red), toDecByte(color.green), toDecByte(color.blue)].join(", ");

/**
 * 解析颜色分量：
 * - 0xFF / 0XFF：十六进制
 * - 255：纯数字按十进制
 * - 其他（如无前缀的 FF）：视为无效，返回 undefined
 *
 * 注意：无 0x 前缀的十六进制写法不支持，
 * 因为「10 是十进制字符串还是十六进制」存在歧义。
 */
export const parseComponent = (raw: string): number | undefined => {
  const value = raw.trim();

  if (/^0[xX][0-9a-fA-F]+$/.test(value)) {
    const result = Number.parseInt(value.slice(2), 16);
    return Number.isFinite(result) ? result : undefined;
  }

  if (/^[0-9]+$/.test(value)) {
    const result = Number.parseInt(value, 10);
    return Number.isFinite(result) ? result : undefined;
  }

  return undefined;
};

/** 将 0~255 的颜色分量转换成 VS Code 使用的 0~1。 */
const componentToUnit = (raw: string): number | undefined => {
  const value = parseComponent(raw);
  if (value === undefined) {
    return undefined;
  }

  return clamp(value, 0, 255) / 255;
};

/** 解析 0~1 的 alpha。 */
const parseUnitAlpha = (raw: string): number | undefined => {
  const value = Number.parseFloat(raw);

  if (!Number.isFinite(value)) {
    return undefined;
  }

  return clamp(value, 0, 1);
};

/** 从颜色表达式中取得函数名，保留原来的大小写。 */
const getFunctionName = (text: string): string => {
  const index = text.indexOf("(");
  return index >= 0 ? text.slice(0, index) : text;
};

/**
 * 逐行匹配文档。
 *
 * 使用 exec() 的 match.index 计算准确位置，
 * 不再使用 indexOf() 搜索重复字符串的位置。
 */
const forEachMatch = (
  document: vscode.TextDocument,
  regex: RegExp,
  token: vscode.CancellationToken,
  callback: (match: RegExpExecArray, line: number) => boolean | void,
): void => {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;

  // 每次调用创建独立正则，避免 lastIndex 在多次调用间残留。
  const re = new RegExp(regex.source, flags);

  for (let line = 0; line < document.lineCount; line++) {
    if (token.isCancellationRequested) { return; }
    const lineText = document.lineAt(line).text;

    re.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = re.exec(lineText)) !== null) {
      if (callback(match, line) === false) {
        return;
      }

      // 防止意外出现零宽匹配导致死循环。
      if (match[0].length === 0) {
        re.lastIndex++;
      }
    }
  }
};

/** 创建颜色信息。 */
const createColorInformation = (
  line: number,
  start: number,
  length: number,
  color: vscode.Color,
): vscode.ColorInformation => {
  const range = new vscode.Range(line, start, line, start + length);

  return new vscode.ColorInformation(range, color);
};

// ============================================================
// War3 颜色：|cAARRGGBB
// ============================================================

const WAR3_HEX_REGEX = /\|[cC]([0-9a-fA-F]{8})/g;

export class HexDocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, WAR3_HEX_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const hex = match[1];

      const alpha = Number.parseInt(hex.slice(0, 2), 16) / 255;
      const red = Number.parseInt(hex.slice(2, 4), 16) / 255;
      const green = Number.parseInt(hex.slice(4, 6), 16) / 255;
      const blue = Number.parseInt(hex.slice(6, 8), 16) / 255;

      const color = new vscode.Color(red, green, blue, alpha);

      colors.push(createColorInformation(line, match.index, match[0].length, color));
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);

    // 把 |cAARRGGBB 拆成「前缀 + hex + 后缀」，
    // 只替换中间 8 位 hex，前后原样保留。
    const matched = originalText.match(/^(\|[cC])([0-9a-fA-F]{8})([\s\S]*)$/);

    const result = matched ? `${matched[1]}${formatHexCase(colorToWar3Hex(color), matched[2], context.document)}${matched[3]}` : originalText;

    return [new vscode.ColorPresentation(result)];
  }
}

// ============================================================
// CSS HEX：#RGB / #RGBA / #RRGGBB / #RRGGBBAA
// ============================================================

/**
 * # 后紧跟合法 hex，且 # 前一个字符不是 hex 字符（lookbehind）。
 * 用 lookbehind 取代前置捕获组，避免消费前置字符，
 * 同时放宽对 x#FFF 这类（x 非 hex）的识别。
 */
const CSS_HEX_REGEX =
  /(?<![0-9a-fA-F])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

export class CssDocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, CSS_HEX_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const hex = match[1];

      let red: number;
      let green: number;
      let blue: number;
      let alpha = 1;

      if (hex.length === 3 || hex.length === 4) {
        red = Number.parseInt(hex[0] + hex[0], 16) / 255;
        green = Number.parseInt(hex[1] + hex[1], 16) / 255;
        blue = Number.parseInt(hex[2] + hex[2], 16) / 255;

        if (hex.length === 4) {
          alpha = Number.parseInt(hex[3] + hex[3], 16) / 255;
        }
      } else {
        red = Number.parseInt(hex.slice(0, 2), 16) / 255;
        green = Number.parseInt(hex.slice(2, 4), 16) / 255;
        blue = Number.parseInt(hex.slice(4, 6), 16) / 255;

        if (hex.length === 8) {
          alpha = Number.parseInt(hex.slice(6, 8), 16) / 255;
        }
      }

      colors.push(
        createColorInformation(
          line,
          match.index,
          match[0].length,
          new vscode.Color(red, green, blue, alpha),
        ),
      );
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);
    const originalHex = originalText.startsWith("#") ? originalText.slice(1) : "";

    // 原来有 alpha 的格式，编辑后也必须保留 alpha。
    const hasAlpha = originalHex.length === 4 || originalHex.length === 8;

    const hex = colorToCssHex(color);

    const outputHex = hasAlpha ? `${hex}${toHexByte(color.alpha)}` : hex;
    const result = `#${formatHexCase(outputHex, originalHex, context.document)}`;

    return [new vscode.ColorPresentation(result)];
  }
}

// ============================================================
// color(r, g, b, a)
// 四个分量均为 0~255，支持十进制和十六进制分量
// ============================================================

const COLOR4_REGEX =
  /\bcolor\(\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*\)/gi;

export class ColorDocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, COLOR4_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const red = componentToUnit(match[1]);
      const green = componentToUnit(match[2]);
      const blue = componentToUnit(match[3]);
      const alpha = componentToUnit(match[4]);

      if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
        return;
      }

      colors.push(
        createColorInformation(
          line,
          match.index,
          match[0].length,
          new vscode.Color(red, green, blue, alpha),
        ),
      );
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);
    const functionName = getFunctionName(originalText);

    return [new vscode.ColorPresentation(`${functionName}(${colorToFourComponents(color)})`)];
  }
}

// ============================================================
// color(r, g, b)
// 三个分量均为 0~255
// ============================================================

const COLOR3_REGEX =
  /\bcolor\(\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*\)/gi;

class Color3DocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, COLOR3_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const red = componentToUnit(match[1]);
      const green = componentToUnit(match[2]);
      const blue = componentToUnit(match[3]);

      if (red === undefined || green === undefined || blue === undefined) {
        return;
      }

      colors.push(
        createColorInformation(
          line,
          match.index,
          match[0].length,
          new vscode.Color(red, green, blue, 1),
        ),
      );
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);
    const functionName = getFunctionName(originalText);

    return [new vscode.ColorPresentation(`${functionName}(${colorToThreeComponents(color)})`)];
  }
}

// ============================================================
// rgba(r, g, b, a)
// RGB 分量为 0~255，alpha 为 0~1
// ============================================================

const RGBA_REGEX =
  /\brgba\(\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*((?:\d+(?:\.\d*)?|\.\d+))\s*\)/gi;

export class RGBADocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, RGBA_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const red = componentToUnit(match[1]);
      const green = componentToUnit(match[2]);
      const blue = componentToUnit(match[3]);
      const alpha = parseUnitAlpha(match[4]);

      if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
        return;
      }

      colors.push(
        createColorInformation(
          line,
          match.index,
          match[0].length,
          new vscode.Color(red, green, blue, alpha),
        ),
      );
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);
    const functionName = getFunctionName(originalText);

    const precision = vscode.workspace.getConfiguration("color4wc3text", context.document.uri)
      .get<number>("floatPrecision", 3);
    // 保留十进制写法，避免小数转换成当前解析器不支持的科学计数法。
    const alpha = clamp(color.alpha, 0, 1).toFixed(precision)
      .replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");

    return [new vscode.ColorPresentation(`${functionName}(${colorToThreeComponents(color)}, ${alpha})`)];
  }
}

// ============================================================
// rgb(r, g, b)
// RGB 分量为 0~255
// ============================================================

const RGB_REGEX =
  /\brgb\(\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*,\s*(0[xX][0-9a-fA-F]+|[0-9a-fA-F]+)\s*\)/gi;

class RGBDocumentColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorInformation[]> {
    const colors: vscode.ColorInformation[] = [];

    forEachMatch(document, RGB_REGEX, token, (match, line) => {
      if (token.isCancellationRequested) {
        return false;
      }

      const red = componentToUnit(match[1]);
      const green = componentToUnit(match[2]);
      const blue = componentToUnit(match[3]);

      if (red === undefined || green === undefined || blue === undefined) {
        return;
      }

      colors.push(
        createColorInformation(
          line,
          match.index,
          match[0].length,
          new vscode.Color(red, green, blue, 1),
        ),
      );
    });

    return token.isCancellationRequested ? [] : colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: {
      document: vscode.TextDocument;
      range: vscode.Range;
    },
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.ColorPresentation[]> {
    if (token.isCancellationRequested) {
      return [];
    }

    const originalText = context.document.getText(context.range);
    const functionName = getFunctionName(originalText);

    return [new vscode.ColorPresentation(`${functionName}(${colorToThreeComponents(color)})`)];
  }
}

// ============================================================
// 注册 Provider
// ============================================================

/**
 * 需要在 extension.ts 的 activate(context) 中调用。
 *
 * 所有注册返回的 Disposable 都加入 context.subscriptions，
 * 扩展停用或重新加载时 VS Code 会自动清理。
 */
export function registerColorProviders(context: vscode.ExtensionContext): void {
  // War3 HEX：|cAARRGGBB
  const war3HexLanguages = [
    "jass",
    "lua",
    "ini",
    "vjass",
    "zinc",
    "fdf",
    "xml",
    "json",
    "js",
    "javascript",
    "typescript",
  ];

  // color(r, g, b) / color(r, g, b, a)
  const colorFunctionLanguages = ["jass", "lua", "vjass", "zinc", "js", "javascript", "typescript"];

  /**
   * 自定义 #HEX 识别：
   * CSS/HTML 的标准语法由 VS Code 原生语言服务处理；
   * JSON 保留自定义识别，以覆盖普通字符串中的 HEX 值；
   * JS/TS、XML、Lua、INI 等也保留自定义识别。
   */
  const hashHexLanguages = ["lua", "ini", "js", "javascript", "typescript", "xml", "json"];

  // rgb()/rgba()：仅在需要自定义识别的语言中注册。
  const rgbFunctionLanguages = ["js", "javascript", "typescript"];

  const register = (languages: readonly string[], provider: vscode.DocumentColorProvider): void => {
    for (const language of languages) {
      context.subscriptions.push(vscode.languages.registerColorProvider(language, provider));
    }
  };

  register(war3HexLanguages, new HexDocumentColorProvider());

  register(colorFunctionLanguages, new ColorDocumentColorProvider());

  register(colorFunctionLanguages, new Color3DocumentColorProvider());

  register(hashHexLanguages, new CssDocumentColorProvider());

  register(rgbFunctionLanguages, new RGBADocumentColorProvider());

  register(rgbFunctionLanguages, new RGBDocumentColorProvider());
}
