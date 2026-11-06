import * as assert from "assert";
import * as vscode from "vscode";

import {
  HexDocumentColorProvider,
  CssDocumentColorProvider,
  ColorDocumentColorProvider,
  parseComponent,
  RGBADocumentColorProvider,
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


suite("格式设置与取消", () => {
  const configuration = () => vscode.workspace.getConfiguration("color4wc3text");
  let previousCase: string | undefined;
  let previousPrecision: number | undefined;
  suiteSetup(async () => {
    previousCase = configuration().inspect<string>("hexCase")?.globalValue;
    previousPrecision = configuration().inspect<number>("floatPrecision")?.globalValue;
  });
  teardown(async () => {
    await configuration().update("hexCase", previousCase, vscode.ConfigurationTarget.Global);
    await configuration().update("floatPrecision", previousPrecision, vscode.ConfigurationTarget.Global);
  });

  test("自动大小写由首个 HEX 字母决定，不受前缀与正文影响", async () => {
    await configuration().update("hexCase", "auto", vscode.ConfigurationTarget.Global);
    const war3 = new HexDocumentColorProvider();
    const css = new CssDocumentColorProvider();
    const color = new vscode.Color(1, 0, 0, 1);
    for (const [original, expected] of [
      ["|C12aB0000ABC|r", "|Cffff0000ABC|r"],
      ["|c12Ab0000abc|r", "|cFFFF0000abc|r"],
      ["|c12345678abc|r", "|cFFFF0000abc|r"],
    ]) {
      assert.strictEqual(firstOrFail(await presentationsOf(war3, color, original), "presentation").label, expected);
    }
    for (const [original, expected] of [["#12aB00", "#ff0000"], ["#12Ab00", "#FF0000"], ["#123456", "#FF0000"]]) {
      assert.strictEqual(firstOrFail(await presentationsOf(css, color, original), "presentation").label, expected);
    }
  });

  test("强制大小写设置实时生效且保留 CSS alpha", async () => {
    for (const [mode, expected] of [["lowercase", "#ff0000ff"], ["uppercase", "#FF0000FF"]]) {
      await configuration().update("hexCase", mode, vscode.ConfigurationTarget.Global);
      assert.strictEqual(firstOrFail(await presentationsOf(new CssDocumentColorProvider(), new vscode.Color(1, 0, 0, 1), "#AbCd"), "presentation").label, expected);
      assert.strictEqual(firstOrFail(await presentationsOf(new HexDocumentColorProvider(), new vscode.Color(1, 0, 0, 1), "|C12345678Text|r"), "presentation").label, mode === "lowercase" ? "|Cffff0000Text|r" : "|CFFFF0000Text|r");
    }
  });

  test("默认三位精度舍入，不补尾零", async () => {
    await configuration().update("floatPrecision", undefined, vscode.ConfigurationTarget.Global);
    assert.strictEqual(configuration().get("floatPrecision"), 3);
    for (const [alpha, original, expected] of [
      [0.004, "rgba(255, 0, 0, 0.004)", "rgba(255, 0, 0, 0.004)"],
      [0.0004, "rgba(255, 0, 0, 0.0004)", "rgba(255, 0, 0, 0)"],
      [0.4, "RGBA(255, 0, 0, .4)", "RGBA(255, 0, 0, 0.4)"],
      [0.1236, "rgba(255, 0, 0, 0.1236)", "rgba(255, 0, 0, 0.124)"],
    ] as const) {
      assert.strictEqual(firstOrFail(await presentationsOf(new RGBADocumentColorProvider(), new vscode.Color(1, 0, 0, alpha), original), "presentation").label, expected);
    }
  });

  test("浮点精度设置实时生效", async () => {
    await configuration().update("floatPrecision", 5, vscode.ConfigurationTarget.Global);
    assert.strictEqual(firstOrFail(await presentationsOf(new RGBADocumentColorProvider(), new vscode.Color(1, 0, 0, 0.123456), "rgba(255, 0, 0, .5)"), "presentation").label, "rgba(255, 0, 0, 0.12346)");
  });

  test("零位精度与极小小数保持可重新识别的十进制格式", async () => {
    const provider = new RGBADocumentColorProvider();
    for (const [precision, alpha, expected] of [[0, 0.4, "0"], [0, 0.8, "1"], [7, 0.0000001, "0.0000001"]] as const) {
      await configuration().update("floatPrecision", precision, vscode.ConfigurationTarget.Global);
      const label = firstOrFail(await presentationsOf(provider, new vscode.Color(1, 0, 0, alpha), "rgba(255, 0, 0, 1)"), "presentation").label;
      assert.strictEqual(label, `rgba(255, 0, 0, ${expected})`);
      assert.strictEqual(firstOrFail(await colorsOf(provider, label), "round trip").color.alpha, Number(expected));
    }
  });

  test("已取消的无颜色文档不读取任何行", async () => {
    let reads = 0;
    const document = { lineCount: 10000, lineAt: () => { reads++; return { text: "无颜色正文" }; } } as unknown as vscode.TextDocument;
    const token = { isCancellationRequested: true } as vscode.CancellationToken;
    assert.deepStrictEqual(await new HexDocumentColorProvider().provideDocumentColors(document, token), []);
    assert.strictEqual(reads, 0);
  });

  test("无匹配行之间也检查取消", async () => {
    let reads = 0;
    const token = { isCancellationRequested: false };
    const document = { lineCount: 10000, lineAt: () => { reads++; token.isCancellationRequested = true; return { text: "无颜色正文" }; } } as unknown as vscode.TextDocument;
    assert.deepStrictEqual(await new CssDocumentColorProvider().provideDocumentColors(document, token as vscode.CancellationToken), []);
    assert.strictEqual(reads, 1);
  });
});
