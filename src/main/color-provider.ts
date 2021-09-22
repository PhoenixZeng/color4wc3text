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
const ceilToStr = (int: number,isHex?: boolean) => {
  if (isHex) {
    return '0x'+Math.ceil(int * 255).toString(16).padStart(2, "0");
  }
  return Math.ceil(int * 255).toString(10);
}

const color2ColorClassColorCode = (color: vscode.Color,flags?:boolean[]) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let a = color.alpha;
    let colorCodeString:string
    if (flags) {
      colorCodeString = ceilToStr(r,flags[0])+", "+ceilToStr(g,flags[1])+", "+ceilToStr(b,flags[2])+", "+ceilToStr(a,flags[3]);
    }else{
      colorCodeString = ceilToStr(r)+", "+ceilToStr(g)+", "+ceilToStr(b)+", "+ceilToStr(a);
    }
    return colorCodeString;
  }
  return "0, 0, 0, 255";
};
const color2Color3ClassColorCode = (color: vscode.Color,flags?:boolean[]) => {
  if (color instanceof vscode.Color) {
    let r = color.red;
    let g = color.green;
    let b = color.blue;
    let colorCodeString:string
    if (flags) {
      colorCodeString = ceilToStr(r,flags[0])+", "+ceilToStr(g,flags[1])+", "+ceilToStr(b,flags[2]);
    }else{
      colorCodeString = ceilToStr(r)+", "+ceilToStr(g)+", "+ceilToStr(b);
    }
    return colorCodeString;
  }
  return "0, 0, 0";
};

const numberFormat = (str: string) => {
  if (str.startsWith("0x") || str.startsWith("0X")) {
    return Number.parseInt(str)
  }
  if (Number.parseInt(str).toString()==str) {
    return Number.parseInt(str)
  }
  if (str.match(new RegExp(/\[0-9a-fA-F]{2}/, "g"))) {
    return Number.parseInt("0x" +str)
  }
  return Number.parseInt(str)
};

class HexDocumentColorProvider implements vscode.DocumentColorProvider {

  /// 颜色改变到文档
  provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]> {
    let lineCount = document.lineCount;
    let colors = new Array<vscode.ColorInformation>();
    let colorReg = new RegExp(/\|[cC][0-9a-fA-F]{8}/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          posstion = lineText.indexOf(x, posstion);
          let range = new vscode.Range(i, posstion, i, posstion + x.length);
          let a = numberFormat( lineText.substr(posstion + 2, 2)) / 255;
          let r = numberFormat( lineText.substr(posstion + 4, 2)) / 255;
          let g = numberFormat( lineText.substr(posstion + 6, 2)) / 255;
          let b = numberFormat( lineText.substr(posstion + 8, 2)) / 255;
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
          let r = numberFormat( lineText.substr(posstion + 1, 2)) / 255;
          let g = numberFormat( lineText.substr(posstion + 3, 2)) / 255;
          let b = numberFormat( lineText.substr(posstion + 5, 2)) / 255;
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
    let colorReg = new RegExp(/[cC]olor\( *\w+( *, *\w+ *){3}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *(\w+) *, *(\w+) *, *(\w+) *, *(\w+) */));
          if (nums) {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums?nums[1]:"255") / 255;
            let g = numberFormat(nums?nums[2]:"255") / 255;
            let b = numberFormat(nums?nums[3]:"255") / 255;
            let a = numberFormat(nums?nums[4]:"255") / 255;
            
            this.startsWithUppers.set(x, x.charCodeAt(0) >= 65 && x.charCodeAt(0)<=90) ;
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
            posstion += x.length;
          }
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
    let colorReg = new RegExp(/[cC]olor\( *[0-9A-Fa-fxX]+( *, *[0-9A-Fa-fxX]+ *){2}\)/, "g");
    for (let i = 0; i < lineCount; i++) {
      let lineText = document.lineAt(i).text;
      let colotSet = lineText.match(colorReg);
      let posstion = 0;
      if (colotSet) {
        colotSet.forEach(x => {
          let nums = x.match(new RegExp(/ *([0-9A-Fa-fxX]+) *, *([0-9A-Fa-fxX]+) *, *([0-9A-Fa-fxX]+) */));
          if(nums)
          {
            posstion = lineText.indexOf(x, posstion);
            let range = new vscode.Range(i, posstion, i, posstion + x.length);
            let r = numberFormat(nums?nums[1]:"255") / 255;
            let g = numberFormat(nums?nums[2]:"255") / 255;
            let b = numberFormat(nums?nums[3]:"255") / 255;
            let a = 1;
            this.startsWithUppers.set(x, x.charCodeAt(0) >= 65 && x.charCodeAt(0)<=90) ;
            colors.push(new vscode.ColorInformation(range, new vscode.Color(r, g, b, a)));
            posstion += x.length;
          }
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

const hexSupportLanguages = ["jass","lua","ini","vjass","zinc","fdf","json","javascript","typescript"];
const colorSupportLanguages = ["lua","vjass","zinc","javascript","typescript"];
const cssSupportLanguages = ["css","html","xml","json","javascript","typescript"];

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
