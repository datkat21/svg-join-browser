import svgJoin from "./svg-join.js";

const svgList = (await import("./example-svg-list.js")).default;

const result = await svgJoin({
  sources: svgList,
});

document.body.insertAdjacentHTML('beforeend', `
  <style>${result.css}</style>

  ${result.svg}
`)