import * as assert from "assert";
import * as vscode from "vscode";

import {
  HexDocumentColorProvider,
  CssDocumentColorProvider,
  ColorDocumentColorProvider,
  parseComponent,
} from "../../main/color-provider";

// —— 测试用 mock ——

const fakeContext = (text: string) => ({
  document: { getText: () => text } as unknown as vscode.TextDocument,
  range: {} as vscode.Range,
});

const fakeToken = { isCancellationRequested: false } as vscode.CancellationToken;

const fakeDocument = (text: string): vscode.TextDocument =>
  ({
    lineCount: 1,
    lineAt: () => ({ text }),
  }) as unknown as vscode.TextDocument;

/**
 * ProviderResult<T[]> 展开后是 T[] | undefined | null | Thenable<...>，
 * await 之后也不保证是数组，统一收成 [] 再断言。
 */
async function colorsOf(
  provider: vscode.DocumentColorProvider,
  text: string,
): Promise<vscode.ColorInformation[]> {
  return (await provider.provideDocumentColors(fakeDocument(text), fakeToken)) ?? [];
}

async function presentationsOf(
  provider: vscode.DocumentColorProvider,
  color: vscode.Color,
  original: string,
): Promise<vscode.ColorPresentation[]> {
  return (await provider.provideColorPresentations(color, fakeContext(original), fakeToken)) ?? [];
}

/** 取第一个元素并窄化类型，缺失时让测试直接失败。 */
function firstOrFail<T>(items: T[], message: string): T {
  const [first] = items;
  assert.ok(first, message);
  return first;
}

suite("Color Providers", () => {
  suite("War3 |cAARRGGBB", () => {
    const provider = new HexDocumentColorProvider();

    test("识别 |cAARRGGBB 并保留 |r 后缀", async () => {
      const text = "|cFFFFE7AE[●伤害细节]|r";
      const colors = await colorsOf(provider, text);

      assert.strictEqual(colors.length, 1);
      const info = firstOrFail(colors, "expected one color");

      assert.strictEqual(info.range.start.character, 0);
      assert.strictEqual(info.range.end.character, 10); // 只覆盖 |cFFFFE7AE

      const c = info.color;
      assert.strictEqual(Math.round(c.alpha * 255), 0xff);
      assert.strictEqual(Math.round(c.red * 255), 0xff);
      assert.strictEqual(Math.round(c.green * 255), 0xe7);
      assert.strictEqual(Math.round(c.blue * 255), 0xae);
    });

    test("颜色代码后可直接跟随十六进制字符开头的正文", async () => {
      for (const text of ["|cFFFF0000Attack|r", "|cFFFF0000123|r"]) {
        const colors = await colorsOf(provider, text);
        assert.strictEqual(colors.length, 1);
        const info = firstOrFail(colors, "expected one color");
        assert.strictEqual(info.range.end.character, 10);
        assert.strictEqual(info.color.red, 1);
        assert.strictEqual(info.color.green, 0);
        assert.strictEqual(info.color.blue, 0);
      }
    });

    test("回写保留 |r 后缀", async () => {
      const presentations = await presentationsOf(
        provider,
        new vscode.Color(1, 0, 0, 1),
        "|cFFFFE7AE[●伤害细节]|r",
      );
      const presentation = firstOrFail(presentations, "expected one presentation");

      assert.strictEqual(presentation.label, "|cFFFF0000[●伤害细节]|r");
    });

    test("回写保留 |C 大写前缀", async () => {
      const presentations = await presentationsOf(
        provider,
        new vscode.Color(0, 1, 0, 1),
        "|CFF00FF00",
      );
      const presentation = firstOrFail(presentations, "expected one presentation");

      assert.strictEqual(presentation.label, "|CFF00FF00");
    });
  });

  suite("CSS HEX", () => {
    const provider = new CssDocumentColorProvider();

    test("#FFF 前面是 hex 字符时不匹配", async () => {
      const colors = await colorsOf(provider, "F#FFF");
      assert.strictEqual(colors.length, 0);
    });

    test("#FFF 前面是非 hex 字符时匹配", async () => {
      const colors = await colorsOf(provider, "x#FFF");

      assert.strictEqual(colors.length, 1);
      const info = firstOrFail(colors, "expected one color");

      assert.strictEqual(info.range.start.character, 1); // 只覆盖 #FFF
      assert.strictEqual(info.range.end.character, 5);
    });

    test("#RGB 与 #RRGGBB 得到相同颜色", async () => {
      const short = firstOrFail(await colorsOf(provider, "#F0A"), "expected short hex color");
      const long = firstOrFail(await colorsOf(provider, "#FF00AA"), "expected long hex color");

      assert.strictEqual(short.color.red, long.color.red);
      assert.strictEqual(short.color.green, long.color.green);
      assert.strictEqual(short.color.blue, long.color.blue);
    });

    test("#RGBA 回写保持 alpha（8 位输出）", async () => {
      const presentations = await presentationsOf(
        provider,
        new vscode.Color(0, 0, 1, 0.5),
        "#0000FF80",
      );
      const presentation = firstOrFail(presentations, "expected one presentation");

      // alpha=0.5 → 128 → 0x80
      assert.strictEqual(presentation.label, "#0000FF80");
    });
  });

  suite("color(r, g, b, a)", () => {
    const provider = new ColorDocumentColorProvider();

    test("0x 前缀按十六进制解析", async () => {
      const colors = await colorsOf(provider, "color(0xFF, 0x00, 0x00, 0xFF)");
      const info = firstOrFail(colors, "expected one color");

      assert.strictEqual(Math.round(info.color.red * 255), 255);
      assert.strictEqual(Math.round(info.color.alpha * 255), 255);
    });

    test("无 0x 前缀的十六进制分量视为无效", async () => {
      const colors = await colorsOf(provider, "color(FF, 0, 0, 255)");
      assert.strictEqual(colors.length, 0);
    });

    test("纯十进制分量有效", async () => {
      const colors = await colorsOf(provider, "color(255, 0, 0, 255)");
      const info = firstOrFail(colors, "expected one color");

      assert.strictEqual(Math.round(info.color.red * 255), 255);
    });
  });

  suite("parseComponent", () => {
    test("0x 前缀走十六进制", () => {
      assert.strictEqual(parseComponent("0xFF"), 255);
      assert.strictEqual(parseComponent("0X10"), 16);
    });
    test("纯数字走十进制", () => {
      assert.strictEqual(parseComponent("255"), 255);
      assert.strictEqual(parseComponent("10"), 10); // 不是 0x10
    });
    test("无前缀字母视为无效", () => {
      assert.strictEqual(parseComponent("FF"), undefined);
      assert.strictEqual(parseComponent("abc"), undefined);
    });
  });
});
