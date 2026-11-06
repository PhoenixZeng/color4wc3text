import * as assert from "assert";
import * as vscode from "vscode";
import { normalizeWar3Colors, renderWar3Preview } from "../../main/war3-preview.js";

suite("War3 预览与规范化", () => {
  test("颜色切换前及末尾补齐闭合标记，不恢复外层颜色", () => {
    const input = "|cFFFF0000红|cFF00FF00绿|r默认|r";
    const output = "|cFFFF0000红|r|cFF00FF00绿|r默认|r";
    assert.strictEqual(normalizeWar3Colors(input), output);
    assert.strictEqual(renderWar3Preview(input), renderWar3Preview(output));
    assert.strictEqual(normalizeWar3Colors("|cFFFF0000红"), "|cFFFF0000红|r");
  });

  test("规范化幂等且保留原有大小写、换行、闭合与正文", () => {
    const input = "前文|CffAa0000甲\n乙|n丙|cFF00ff00丁|r尾文";
    const result = normalizeWar3Colors(input);
    assert.strictEqual(result, "前文|CffAa0000甲\n乙|n丙|r|cFF00ff00丁|r尾文");
    assert.strictEqual(normalizeWar3Colors(result), result);
    assert.strictEqual(normalizeWar3Colors("普通正文|r"), "普通正文|r");
  });

  test("转义竖线与不完整颜色代码保持原样", () => {
    const text = "||cFFFF0000文本 |cFFF";
    assert.strictEqual(normalizeWar3Colors(text), text);
    assert.strictEqual(renderWar3Preview(text), "<span><span>|</span><span>cFFFF0000文本&nbsp;|cFFF</span></span> ");
  });

  test("预览按 RGB 分段，重置后使用默认色并转义正文 HTML", () => {
    assert.strictEqual(renderWar3Preview('|c00FF0000红|cFF00FF00绿|r<>&"\n尾'),
      '<span><span style="color:#FF0000;">红</span><span style="color:#00FF00;">绿</span><span>&lt;&gt;&amp;"<br>尾</span></span> ');
  });

  suite("真实编辑器集成", () => {
    suiteSetup(async () => {
      const extension = vscode.extensions.getExtension("PhoenixZeng.color4wc3text");
      assert.ok(extension);
      await extension.activate();
    });
    teardown(async () => {
      if (vscode.window.activeTextEditor?.document.uri.scheme === "untitled") {
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    });

    async function open(text: string) {
      const document = await vscode.workspace.openTextDocument({ language: "xml", content: text });
      const editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(text.length));
      return { document, editor };
    }
    async function preview(document: vscode.TextDocument, offset: number) {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", document.uri, document.positionAt(offset));
      return hovers?.flatMap(hover => hover.contents).find(content => typeof content !== "string" && "value" in content && content.value.includes("color:#")) as vscode.MarkdownString | undefined;
    }
    function action(markdown: vscode.MarkdownString): { command: string; id: number } {
      const match = markdown.value.match(/command:([^?]+)\?([^\s)]*)/);
      assert.ok(match);
      return { command: match[1], id: JSON.parse(decodeURIComponent(match[2]))[0] };
    }

    test("XML 只在颜色头提供共用预览，正文不弹面板", async () => {
      const { document } = await open("<text>|cFFFF0000红色|cFF00FF00绿色</text>");
      const colors = await vscode.commands.executeCommand<vscode.ColorInformation[]>("vscode.executeDocumentColorProvider", document.uri);
      assert.ok(colors.some(color => color.range.start.character === 6 && color.range.end.character === 16));
      assert.strictEqual(await preview(document, 16), undefined);
      assert.ok(await preview(document, 8));
    });

    test("预览按钮规范化选区，一次撤销恢复原文", async () => {
      const input = "<text>|cFFFF0000红色|cFF00FF00绿色</text>";
      const { document } = await open(input);
      const markdown = await preview(document, 10);
      assert.ok(markdown);
      assert.ok(markdown.value.includes("\n\n---\n\n[**$(wand) 标准化**]"));
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), "<text>|cFFFF0000红色|r|cFF00FF00绿色|r</text>");
      await vscode.commands.executeCommand("undo");
      assert.strictEqual(document.getText(), input);
    });

    test("文档改变后旧预览按钮不修改文本", async () => {
      const { document, editor } = await open("<text>|cFFFF0000红色</text>");
      const markdown = await preview(document, 10);
      assert.ok(markdown);
      const link = action(markdown);
      await editor.edit(edit => edit.insert(document.positionAt(0), "新"));
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), false);
      assert.strictEqual(document.getText(), "新<text>|cFFFF0000红色</text>");
    });

    test("Lua 无选区悬停颜色头，预览整个字符串并仅修改引号内正文", async () => {
      const input = 'local a = "|cFFFF0000红色 |cFF00FF00绿色" -- 注释';
      const { document, editor } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lua");
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      const markdown = await preview(document, input.indexOf("|c") + 2);
      assert.ok(markdown);
      assert.ok(markdown.value.includes("红色") && markdown.value.includes("绿色"));
      assert.ok(!markdown.value.includes("local") && !markdown.value.includes("注释"));
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), 'local a = "|cFFFF0000红色 |r|cFF00FF00绿色|r" -- 注释');
    });

    test("后一个颜色头使用自身范围作为合并 Hover 锚点", async () => {
      const input = 'local a = "|cFFFF0000红色|cFF00FF00绿色"';
      const { document, editor } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lua");
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      const offset = input.indexOf("|cFF00FF00");
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", document.uri, document.positionAt(offset + 2));
      const hover = hovers.find(item => item.contents.some(content => typeof content !== "string" && "value" in content && content.value.includes("color:#")));
      assert.ok(hover?.range);
      assert.strictEqual(hover.range.start.character, offset);
      assert.strictEqual(hover.range.end.character, offset + 10);
    });

    test("XML 无选区预览文本节点，规范化不修改标签", async () => {
      const input = '<text>|cFFFF0000红色|cFF00FF00绿色</text>';
      const { document, editor } = await open(input);
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      const markdown = await preview(document, input.indexOf("|c") + 2);
      assert.ok(markdown);
      assert.ok(!markdown.value.includes("&lt;text&gt;"));
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), '<text>|cFFFF0000红色|r|cFF00FF00绿色|r</text>');
    });

    test("引号转义与多个字符串不会跨边界规范化", async () => {
      const input = String.raw`local a = "前\"文|cFFFF0000红" .. "|cFF00FF00绿"`;
      const { document, editor } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lua");
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      const markdown = await preview(document, input.indexOf("|c") + 2);
      assert.ok(markdown);
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), String.raw`local a = "前\"文|cFFFF0000红|r" .. "|cFF00FF00绿"`);
    });

    test("整行选区不扩大 Lua 字符串的标准化范围", async () => {
      const input = 'local x = "|cFFFF0000正文" -- 不应修改';
      const { document } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lua");
      const markdown = await preview(document, input.indexOf("|c") + 2);
      assert.ok(markdown);
      assert.ok(!markdown.value.includes("local") && !markdown.value.includes("不应修改"));
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), 'local x = "|cFFFF0000正文|r" -- 不应修改');
    });

    test("Lua 跨行长字符串只修改完整正文，不修改定界符", async () => {
      const input = 'local x = [=[\n前文|cFFFF0000红\n|cFF00FF00绿]=]';
      const { document } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lua");
      const markdown = await preview(document, input.indexOf("|cFF00FF00") + 2);
      assert.ok(markdown);
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), 'local x = [=[\n前文|cFFFF0000红\n|r|cFF00FF00绿|r]=]');
    });

    test("LNI 赋值正文在共用面板内标准化", async () => {
      const input = 'Name = "|cFFFF0000正文" -- 注释';
      const { document } = await open(input);
      await vscode.languages.setTextDocumentLanguage(document, "lni");
      const markdown = await preview(document, input.indexOf("|c") + 2);
      assert.ok(markdown);
      const link = action(markdown);
      assert.strictEqual(await vscode.commands.executeCommand(link.command, link.id), true);
      assert.strictEqual(document.getText(), 'Name = "|cFFFF0000正文|r" -- 注释');
    });

    test("边界未知即使选中也不预览", async () => {
      const { document, editor } = await open("|cFFFF0000红色|r");
      editor.selection = new vscode.Selection(document.positionAt(10), document.positionAt(10));
      assert.strictEqual(await preview(document, 2), undefined);
    });
  });
});
