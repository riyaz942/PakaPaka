// Builds the sign-in page palette from mobile/src/global.css: the `--color-*`
// declarations of the light `:root` block and of the dark `:root` block.
function declarations(block) {
  return [...block.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}:${m[2].trim()}`).join(";");
}

// Returns the text between the braces that open at `openIndex`.
function braceBody(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(openIndex + 1, i);
  }
  throw new Error("unbalanced braces in global.css");
}

export function tokenCss(globalCssText) {
  const css = globalCssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const media = css.search(/@media\s*\(prefers-color-scheme:\s*dark\)/);
  if (media < 0) throw new Error("dark @media block not found in global.css");
  const darkBody = braceBody(css, css.indexOf("{", media));
  const dark = declarations(braceBody(darkBody, darkBody.indexOf("{")));
  const light = declarations(braceBody(css, css.indexOf("{", css.search(/:root\s*\{/))));
  if (!light || !dark) throw new Error("no --color-* declarations found in global.css");
  return `:root{${light}}@media (prefers-color-scheme: dark){:root{${dark}}}`;
}
