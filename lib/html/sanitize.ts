import { fromHtml } from "hast-util-from-html";
import { defaultSchema, sanitize } from "hast-util-sanitize";
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import { visit } from "unist-util-visit";
import type { Element, Nodes, Properties } from "hast";
import type { Schema } from "hast-util-sanitize";

const ALLOWED_CSS = new Set([
  "background",
  "background-color",
  "border",
  "border-collapse",
  "border-color",
  "border-style",
  "border-width",
  "color",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "text-indent",
  "vertical-align",
  "white-space",
  "width",
]);

const OFFICE_SCHEMA: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "col",
    "colgroup",
    "h1",
    "h2",
    "h3",
    "h4",
    "img",
    "s",
    "span",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colSpan", "rowSpan"],
    th: ["colSpan", "rowSpan"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
  strip: [...new Set([...(defaultSchema.strip ?? []), "script", "style"])],
};

function sanitizeCss(value: string): string | undefined {
  if (
    /\\|(?:expression|url|image|image-set)\s*\(|@import|javascript:|behavior:|-moz-binding/i.test(
      value,
    )
  ) {
    return undefined;
  }

  const kept: string[] = [];
  for (const part of value.split(";")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!prop || !val || !ALLOWED_CSS.has(prop)) continue;
    if (/[<>]|url\s*\(/i.test(val)) continue;
    kept.push(`${prop}: ${val}`);
  }
  return kept.length ? kept.join("; ") : undefined;
}

function cleanTree(tree: Nodes): void {
  visit(tree, "element", (node: Element) => {
    const properties = node.properties as Properties | undefined;
    if (!properties) return;

    const style = properties.style;
    if (typeof style === "string") {
      const clean = sanitizeCss(style);
      if (clean) properties.style = clean;
      else delete properties.style;
    }

    if (node.tagName === "a" && properties.target === "_blank") {
      const rel = Array.isArray(properties.rel)
        ? properties.rel.map(String)
        : String(properties.rel ?? "")
            .split(/\s+/)
            .filter(Boolean);
      for (const token of ["noopener", "noreferrer"]) {
        if (!rel.includes(token)) rel.push(token);
      }
      properties.rel = rel;
    }
  });
}

export function sanitizeOfficeHtml(html: string): string {
  const tree = sanitize(fromHtml(html || "", { fragment: true }), OFFICE_SCHEMA);
  cleanTree(tree);
  return toHtml(tree);
}

export function htmlToPlainText(html: string): string {
  return toText(fromHtml(html || "", { fragment: true }))
    .replace(/\s+/g, " ")
    .trim();
}
