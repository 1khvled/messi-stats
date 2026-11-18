import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const LANGS = ["en", "es", "pt", "fr", "ro", "uz", "ar"];

const SUBPAGES = [
  "index",
  "dashboard",
  "goalsbyseason",
  "goalsbyyear",
  "timeline",
  "achievements",
  "birthday",
  "messi-vs-ronaldo",
  "vs-real-madrid",
  "champions-league",
  "latest-goal",
  "gear"
];

// 20 reciprocal hreflang tags across 7 locales
function getHreflangTags(pageSlug) {
  const slugPath = pageSlug === "index" || !pageSlug ? "" : `/${pageSlug}`;
  return [
    `<link rel="alternate" hreflang="en" href="https://www.messistat.com/en${slugPath}"/>`,
    `<link rel="alternate" hreflang="en-US" href="https://www.messistat.com/en${slugPath}"/>`,
    `<link rel="alternate" hreflang="en-NG" href="https://www.messistat.com/en${slugPath}"/>`,
    `<link rel="alternate" hreflang="en-IN" href="https://www.messistat.com/en${slugPath}"/>`,
    `<link rel="alternate" hreflang="en-PH" href="https://www.messistat.com/en${slugPath}"/>`,
    `<link rel="alternate" hreflang="es" href="https://www.messistat.com/es${slugPath}"/>`,
    `<link rel="alternate" hreflang="es-AR" href="https://www.messistat.com/es${slugPath}"/>`,
    `<link rel="alternate" hreflang="es-ES" href="https://www.messistat.com/es${slugPath}"/>`,
    `<link rel="alternate" hreflang="pt" href="https://www.messistat.com/pt${slugPath}"/>`,
    `<link rel="alternate" hreflang="pt-BR" href="https://www.messistat.com/pt${slugPath}"/>`,
    `<link rel="alternate" hreflang="pt-PT" href="https://www.messistat.com/pt${slugPath}"/>`,
    `<link rel="alternate" hreflang="fr" href="https://www.messistat.com/fr${slugPath}"/>`,
    `<link rel="alternate" hreflang="fr-FR" href="https://www.messistat.com/fr${slugPath}"/>`,
    `<link rel="alternate" hreflang="fr-NE" href="https://www.messistat.com/fr${slugPath}"/>`,
    `<link rel="alternate" hreflang="ro" href="https://www.messistat.com/ro${slugPath}"/>`,
    `<link rel="alternate" hreflang="ro-RO" href="https://www.messistat.com/ro${slugPath}"/>`,
    `<link rel="alternate" hreflang="uz" href="https://www.messistat.com/uz${slugPath}"/>`,
    `<link rel="alternate" hreflang="ar" href="https://www.messistat.com/ar${slugPath}"/>`,
    `<link rel="alternate" hreflang="ar-EG" href="https://www.messistat.com/ar${slugPath}"/>`,
    `<link rel="alternate" hreflang="x-default" href="https://www.messistat.com/en${slugPath}"/>`
  ].join("\n");
}

function updateFileHreflangs(filePath, lang, slug) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  const slugPath = slug === "index" || !slug ? "" : `/${slug}`;
  const canonicalUrl = `https://www.messistat.com/${lang}${slugPath}`;
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}"/>`;
  const hreflangs = getHreflangTags(slug);

  // Remove existing canonical links
  content = content.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "");
  content = content.replace(/<link[^>]+href=["'][^"']+["'][^>]+rel=["']canonical["'][^>]*>\s*/gi, "");

  // Remove existing alternate/hreflang links
  content = content.replace(/<link[^>]+hreflang=["'][^"']+["'][^>]*>\s*/gi, "");
  content = content.replace(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["'][^"']+["'][^>]*>\s*/gi, "");

  const block = `\n${canonicalTag}\n${hreflangs}\n`;

  if (/<meta[^>]+name=["']description["'][^>]*>/i.test(content)) {
    content = content.replace(/(<meta[^>]+name=["']description["'][^>]*>)/i, `$1${block}`);
  } else if (/<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>/i.test(content)) {
    content = content.replace(/(<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>)/i, `$1${block}`);
  } else if (/<head[^>]*>/i.test(content)) {
    content = content.replace(/(<head[^>]*>)/i, `$1${block}`);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

for (const sub of SUBPAGES) {
  updateFileHreflangs(path.join(rootDir, `${sub}.html`), "en", sub);
}

for (const l of LANGS.filter((x) => x !== "en")) {
  for (const sub of SUBPAGES) {
    updateFileHreflangs(path.join(rootDir, l, `${sub}.html`), l, sub);
  }
}

console.log("Synchronized canonicals and 20 hreflang tags across all 7 languages and 12 pages (84 files)!");
