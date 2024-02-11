"use strict";

import { XmlDocument } from "xmldoc";

const addPX = (x: number) => (isFinite(x) ? x + "px" : x);
const parseUnit = (value = "") => value.replace(/[\d.\s]/g, "");

function errOut(fname: string, message: string) {
  console.error(`File: ${fname}\n${message}`);
}

function lookslike(src: any, trg: any, filter: string[] = []) {
  if (filter.length === 0) filter = Object.keys(src);
  return filter.every((x) => src[x] && src[x] === trg[x]);
}

function equals(src: Record<string, any>, trg: any) {
  const filter = Object.keys(src);
  return (
    filter.length === Object.keys(trg).length &&
    filter.every((x) => src[x] === trg[x])
  );
}

// obj - object, filter - array or object
function deletelike(obj: Record<any, any>, filter: any[]) {
  if (!Array.isArray(filter)) filter = Object.keys(filter);
  filter.forEach((x) => delete obj[x]);
}

function CSS_escape(str: string) {
  return str
    .replace(/([!#$%&()*+,.\\/;<=>?@[\]^`{|}~])/g, "\\$1")
    .replace(/:/g, "\\3A ");
}

function style_keys(str: string) {
  let items = str.match(/\s?[\w-]+:.*?(;|$)/g);
  if (items === null) return [];
  return items.map((x) => x.split(":")[0].trim());
}

// names - array, attr - object
function style_format(names: any[], attr: Record<string, any>) {
  let pad = "  ";
  let head = "." + names.join(",\n.") + " {\n";
  let body = Object.keys(attr)
    .map((x) => `${pad}${x}: ${attr[x]};\n`)
    .join("");
  return head + body + "}\n";
}

// style - array, attr - object
function wipe_style_format(style: any[], attr: any) {
  return style_format(
    style.map((x) => {
      deletelike(x.attr, attr);
      return x.name;
    }),
    attr
  );
}

export default async function (args: {
  /**
   * array of SVG documents to combine
   */
  sources?: any;
  /**
   * prefix for CSS selectors
   */
  prefix?: any;
  /**
   * extract presentation attributes from single-styled SVG to CSS
   */
  mono?: any;
  /**
   * calculate omitted side from viewBox values
   */
  calcSide: any;
}): Promise<{ svg: string; css: string }> {
  console.log(
    `SVG-Join ${
      require("./package.json").version
    } Join svg files in symbol collection.`
  );

  const argv = {
    sources: args.sources /*?? args.s*/,
    // output: args.output /*?? args.o*/ ?? ".",
    // name: args.name /*?? args.n*/ ?? "svg-bundle",
    // cssName: args.cssName,
    prefix: args.prefix /*?? args.p*/ ?? "svg_",
    mono: args.mono /*?? args.m*/ ?? false,
    calcSide: args.calcSide ?? false,
  };

  console.log(args, argv);

  if (argv.sources === undefined) throw new Error("source is not set");

  // const argv = require("yargs")
  //   .example(
  //     'svg-join -s "./svg/*.svg" -o ./public -n mybundle',
  //     "Will create mybundle.svg and mybundle.css in public folder."
  //   )
  //   .example(
  //     'svg-join -s "/your/path/**/*.svg"',
  //     "Find SVG files in subfolders."
  //   )
  //   .strict().argv;

  // const svgout = join(argv.output, argv.name + ".svg");
  // const cssout = join(argv.output, argv.cssName || argv.name + ".css");
  const header = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display:none">
`;
  const preserve = new Set(["viewbox", "preserveaspectratio"]);
  const presentation = new Set([
    "alignment-baseline",
    "baseline-shift",
    "clip",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "cursor",
    "direction",
    "display",
    "dominant-baseline",
    "enable-background",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "flood-color",
    "flood-opacity",
    "font-family",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-variant",
    "font-weight",
    "glyph-orientation-horizontal",
    "glyph-orientation-vertical",
    "image-rendering",
    "kerning",
    "letter-spacing",
    "lighting-color",
    "marker-end",
    "marker-mid",
    "marker-start",
    "mask",
    "opacity",
    "overflow",
    "pointer-events",
    "shape-rendering",
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "text-anchor",
    "text-decoration",
    "text-rendering",
    "unicode-bidi",
    "visibility",
    "word-spacing",
    "writing-mode",
  ]);
  const units = new Set(["em", "rem", "px"]);
  const round = new Set(["px"]);

  let symbols: any[] = [];
  let total = 0;
  let processed = 0;
  let file;

  let returnResult = { svg: "", css: "" };
  try {
    // file = await fsp.open(svgout, "w");
    file = {
      write(text: string) {
        returnResult.svg += text;
      },
      close() {
        /* ... */
      },
    };
    await file.write(header);
    // const list = (
    //   await glob(argv.source, { caseSensitiveMatch: false })
    // ).filter((x) => x !== svgout);
    const list = argv.sources;
    for (const fname of list) {
      total++;
      // const body = await fsp.readFile(fname, encoding);
      const body = fname;
      try {
        const doc = new XmlDocument(body);
        if (doc.name.toLowerCase() !== "svg") {
          throw new Error("Error! The root element must be SVG.");
        }

        let width: any = "auto";
        let height: any = "auto";
        if (doc.attr.viewBox) {
          let vbox = doc.attr.viewBox.split(/\s+/) as any[];
          if (vbox.length === 4) {
            width = +vbox[2] - vbox[0];
            height = +vbox[3] - vbox[1];

            if (argv.calcSide) {
              let w = parseFloat(doc.attr.width);
              let wu = parseUnit(doc.attr.width);
              let h = parseFloat(doc.attr.height);
              let hu = parseUnit(doc.attr.height);
              if (!!w && units.has(wu) && !h) {
                h = (height / width) * w;
                h = (round.has(wu) ? Math.round(h) : h.toFixed(4)) as number;
                doc.attr.height = h + wu;
              } else if (!!h && units.has(hu) && !w) {
                w = (width / height) * h;
                w = (round.has(hu) ? Math.round(w) : w.toFixed(4)) as number;
                doc.attr.width = w + hu;
              }
            }
          }
        }
        const rule: Record<string, any> = {
          attr: {
            width: addPX(doc.attr.width || width),
            height: addPX(doc.attr.height || height),
          },
        };

        doc.name = "symbol";
        Object.keys(doc.attr).forEach((x) => {
          if (!preserve.has(x.toLowerCase())) delete doc.attr[x];
        });
        doc.attr.id = `${total}`;
        // doc.attr.id = basename(fname, extname(fname))
        //   .replace(/\s/g, "_")
        //   .replace(/['"]/g, "");
        rule.name = argv.prefix + CSS_escape(doc.attr.id);

        if (argv.mono) {
          const styled_children = doc.children.filter((x: any) => {
            if (x.attr == undefined) return false;
            let keys = Object.keys(x.attr);
            if (x.attr.style) keys = keys.concat(style_keys(x.attr.style));
            return keys.some((y) => presentation.has(y));
          }) as any[];
          if (styled_children.length === 1) {
            Object.keys(styled_children[0].attr)
              .filter((x) => presentation.has(x))
              .forEach((y) => {
                rule.attr[y] = styled_children[0].attr[y];
                delete styled_children[0].attr[y];
              });
          }
        }

        symbols.push(rule);
        processed++;
        await file.write(doc.toString({ compressed: true }) + "\n");
      } catch (err: any) {
        let error = err as Error;
        errOut(fname, error.message);
      }
    }
    await file.write("</svg>");
    // create and optimize css
    let style = "";
    const wh = ["width", "height"];
    symbols.forEach((symb, index) => {
      if (Object.keys(symb.attr).length === 0) return;
      const rest_symbols = symbols.slice(index);
      let attrs = Object.assign({}, symb.attr);
      let same_size = rest_symbols.filter((x) => lookslike(attrs, x.attr, wh));
      let same_style = rest_symbols.filter((x) => lookslike(attrs, x.attr));
      if (same_size.length > same_style.length) {
        same_size = same_size.map((x) => {
          deletelike(x.attr, wh);
          return x.name;
        });
        let { width, height } = attrs;
        style += style_format(same_size, { width, height });
        if (Object.keys(symb.attr).length > 0) {
          attrs = Object.assign({}, symb.attr);
          same_style = rest_symbols.filter((x) => equals(attrs, x.attr));
          style += wipe_style_format(same_style, attrs);
        }
      } else {
        style += wipe_style_format(same_style, attrs);
      }
    });

    // await fsp.writeFile(cssout, style, encoding);
    returnResult.css = style;
    console.log(`Successfully processed files: ${processed}/${total}.`);
  } catch (err) {
    console.error(err);
  } finally {
    return returnResult;
  }
}
