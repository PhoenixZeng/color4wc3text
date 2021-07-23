/*
 * @Date: 2020-02-20 22:15:07
 * @LastEditTime: 2020-02-21 00:50:33
 */
/*
 * @Date: 2020-02-20 22:15:07
 * @LastEditTime: 2020-02-21 00:35:48
 */
import * as vscode from 'vscode';


/// 颜色提供
const convertInt2Hex = (int: number) => {
  return Math.ceil(int * 255).toString(16).padStart(2, "0");
};
const color2CssColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let colorCodeString =  convertInt2Hex(r) + convertInt2Hex(g) + convertInt2Hex(b);
    return colorCodeString;
  }
  return "000000";
};
const color2JColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let colorCodeString = convertInt2Hex(a) + convertInt2Hex(r) + convertInt2Hex(g) + convertInt2Hex(b);
    return colorCodeString;
  }
  return "00000000";
};
const color2ColorClassColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let colorCodeString = ""+Math.ceil(r * 255)+","+Math.ceil(g * 255)+","+Math.ceil(b * 255)+","+Math.ceil(a * 255);
    return colorCodeString;
  }
  return "0, 0, 0, 0";
};
const color2Color3ClassColorCode = (color: vscode.Color) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let colorCodeString = ""+Math.ceil(r * 255)+","+Math.ceil(g * 255)+","+Math.ceil(b * 255);
    return colorCodeString;
  }
  return "0, 0, 0";
};

class HexDocumentColorProvider implements vscode.DocumentColorProvider {

  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/\|[cC][\da-fA-F]{8}/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let a = Number.parseInt("0x" + lineText.substr(posstion + 2, 2)) / 255;
          let r = Number.parseInt("0x" + lineText.substr(posstion + 4, 2)) / 255;
          let g = Number.parseInt("0x" + lineText.substr(posstion + 6, 2)) / 255;
          let b = Number.parseInt("0x" + lineText.substr(posstion + 8, 2)) / 255;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let document = context.document;
    let range = context.range;
    let documentText = document.getText(range);
    return [new vscode.ColorPresentation(`${
      documentText.substr(0, 2)
      }${
      color2JColorCode(new vscode.Color(r, g, b, a))
      }${
      documentText.substring(10)
      }`)];

  }
}


class CssDocumentColorProvider implements vscode.DocumentColorProvider {

  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/#[\da-fA-F]{6}/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let a = 255 / 255;
          let r = Number.parseInt("0x" + lineText.substr(posstion + 1, 2)) / 255;
          let g = Number.parseInt("0x" + lineText.substr(posstion + 3, 2)) / 255;
          let b = Number.parseInt("0x" + lineText.substr(posstion + 5, 2)) / 255;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let document = context.document;
    let range = context.range;
    let documentText = document.getText(range);
    return [new vscode.ColorPresentation(`#${
      color2CssColorCode(new vscode.Color(r, g, b, a))
    }`)]
  }
}


class ColorDocumentColorProvider implements vscode.DocumentColorProvider {
  startsWithUppers = new Map<string,boolean>();
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[cC]olor\( *(\d+)( *, *\d+ *){3}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\d+) *, *(\d+) *, *(\d+) *, *(\d+) */));
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let r = Number.parseInt(nums?nums[1]:"255") / 255;
          let g = Number.parseInt(nums?nums[2]:"255") / 255;
          let b = Number.parseInt(nums?nums[3]:"255") / 255;
          let a = Number.parseInt(nums?nums[4]:"255") / 255;
          
          this.startsWithUppers.set(x, x.charCodeAt(0) >= 65 && x.charCodeAt(0)<=90) ;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let document = context.document;
    let range = context.range;
    let name = "color";
    if (this.startsWithUppers.get(document.getText(range))) {
      name = 'C' + name.substring(1, name.length)
    }
    return [new vscode.ColorPresentation(name+`(${
        color2ColorClassColorCode(new vscode.Color(r, g, b, a))
      })`)];

  }
}

class Color3DocumentColorProvider implements vscode.DocumentColorProvider {
  startsWithUppers = new Map<string,boolean>();
  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/[cC]olor\( *(\d+)( *, *\d+ *){2}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\d+) *, *(\d+) *, *(\d+) */));
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let r = Number.parseInt(nums?nums[1]:"255") / 255;
          let g = Number.parseInt(nums?nums[2]:"255") / 255;
          let b = Number.parseInt(nums?nums[3]:"255") / 255;
          let a = 1;

          this.startsWithUppers.set(x, x.charCodeAt(0) >= 65 && x.charCodeAt(0)<=90) ;
          colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
          posstion += x.length;
        });
      }
    }
    return colors;
  }
  /// 文档改变到颜色
  provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range; }, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorPresentation[]> {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let document = context.document;
    let range = context.range;
    let name = "color";
    if (this.startsWithUppers.get(document.getText(range))) {
      name = 'C' + name.substring(1, name.length)
    }
    return [new vscode.ColorPresentation(name + `(${
        color2Color3ClassColorCode(new vscode.Color(r, g, b, a))
      })`)];

  }
}

const hexSupportLanguages = ["jass","lua","ini","vjass","zinc","fdf","json"];
const colorSupportLanguages = ["lua","vjass","zinc"];
const cssSupportLanguages = ["css","html","xml","json"];

hexSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new HexDocumentColorProvider);
});
colorSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new ColorDocumentColorProvider);
  vscode.languages.registerColorProvider(language, new Color3DocumentColorProvider);
});
cssSupportLanguages.forEach(language=>{
  vscode.languages.registerColorProvider(language, new CssDocumentColorProvider);
});
