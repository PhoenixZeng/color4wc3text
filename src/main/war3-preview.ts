import * as vscode from "vscode";
import { decodeWar3Text, findWar3TextSpan } from "./war3-text-range.js";
import { war3HexLanguages } from "./color-provider.js";

const normalizeCommand = "color4wc3text.normalizeSelectedWar3";
const tokens = () => /\|\||\|[cC][0-9a-fA-F]{8}|\|r|\|n/g;

/** 只补闭合标记：下一颜色开始前以及选区末尾，不模拟嵌套。 */
export function normalizeWar3Colors(text: string): string {
  let active = false;
  let offset = 0;
  let result = "";
  for (const match of text.matchAll(tokens())) {
    result += text.slice(offset, match.index);
    const token = match[0];
    if (/^\|[cC]/.test(token)) {
      if (active) { result += "|r"; }
      active = true;
    } else if (token === "|r") {
      active = false;
    }
    result += token;
    offset = match.index + token.length;
  }
  return result + text.slice(offset) + (active ? "|r" : "");
}

const escapeHtml = (text: string): string => text
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/ /g, "&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
  .replace(/\r\n|\r|\n/g, "<br>");

/** 按连续颜色状态渲染；|r 回到默认色，而不是上层颜色。 */
export function renderWar3Preview(text: string): string {
  let color: string | undefined;
  let offset = 0;
  let result = "";
  const append = (value: string): void => {
    if (value) {
      result += color ? `<span style="color:#${color};">${escapeHtml(value)}</span>` : `<span>${escapeHtml(value)}</span>`;
    }
  };
  for (const match of text.matchAll(tokens())) {
    append(text.slice(offset, match.index));
    const token = match[0];
    if (/^\|[cC]/.test(token)) {
      // War3 文本颜色预览只使用 RGB，AA 不作为透明度叠加。
      color = token.slice(4);
    } else if (token === "|r") {
      color = undefined;
    } else if (token === "|n") {
      result += "<br>";
    } else {
      append("|");
    }
    offset = match.index + token.length;
  }
  append(text.slice(offset));
  return `<span>${result}</span> `;
}

interface PreviewSnapshot {
  id: number;
  document: vscode.TextDocument;
  version: number;
  range: vscode.Range;
  text: string;
}

export function registerWar3Preview(context: vscode.ExtensionContext): void {
  let snapshot: PreviewSnapshot | undefined;
  let nextId = 0;

  context.subscriptions.push(vscode.languages.registerHoverProvider(war3HexLanguages, {
    provideHover(document, position, token) {
      const editor = vscode.window.activeTextEditor;
      if (token.isCancellationRequested || editor?.document !== document || editor.selections.length !== 1) { return; }
      const span = findWar3TextSpan(document.getText(), document.offsetAt(position), document.languageId, document.fileName);
      if (!span || token.isCancellationRequested) { return; }
      const target = { range: new vscode.Range(document.positionAt(span.start), document.positionAt(span.end)) };
      const text = document.getText(target.range);
      const matches = [...text.matchAll(tokens())].filter(match => /^\|[cC]/.test(match[0]));
      if (!matches.length) { return; }
      const offset = document.offsetAt(position) - document.offsetAt(target.range.start);
      const colorHead = matches.find(match => offset >= match.index && offset < match.index + match[0].length);
      if (!colorHead) { return; }
      // 仅在颜色头返回预览，与原生选择器共用面板。
      const hoverRange = new vscode.Range(document.positionAt(span.start + colorHead.index), document.positionAt(span.start + colorHead.index + colorHead[0].length));
      snapshot = { id: ++nextId, document, version: document.version, range: target.range, text };
      const markdown = new vscode.MarkdownString(renderWar3Preview(decodeWar3Text(document.getText(), span, document.languageId)));
      markdown.supportHtml = true;
      markdown.supportThemeIcons = true;
      markdown.isTrusted = { enabledCommands: [normalizeCommand] };
      const normalized = normalizeWar3Colors(text);
      if (normalized !== text) {
        const args = encodeURIComponent(JSON.stringify([snapshot.id]));
        markdown.appendMarkdown(`

---

[**$(wand) 标准化**](command:${normalizeCommand}?${args} "补齐缺少的 |r")`);
      }
      return new vscode.Hover(markdown, hoverRange);
    },
  }));

  context.subscriptions.push(vscode.commands.registerCommand(normalizeCommand, async (id: number) => {
    const editor = vscode.window.activeTextEditor;
    const current = snapshot;
    // 点击动作绑定到展示时的文本，不能把过期按钮应用到其他版本或文件。
    if (!current || current.id !== id || editor?.document !== current.document || current.version !== current.document.version) { return false; }
    const result = await editor.edit(edit => edit.replace(current.range, normalizeWar3Colors(current.text)), { undoStopBefore: true, undoStopAfter: true });
    snapshot = undefined;
    return result;
  }));

}
