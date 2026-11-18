const { sep } = require("node:path");
const { globSync: matchPaths, hasMagic } = require("glob");

function isDynamicPattern(pattern) {
  return pattern.startsWith("!") || hasMagic(pattern, { magicalBraces: true });
}

function globSync(patterns, options = {}) {
  const { absolute, cwd, dot, ignore = [], onlyDirectories = false } = options;
  const expandDirectories = options.expandDirectories ?? !onlyDirectories;
  const includes = [];
  const excludes = [...ignore];

  for (const pattern of [patterns].flat()) {
    if (pattern.startsWith("!") && !pattern.startsWith("!(")) {
      excludes.push(pattern.slice(1));
    } else if (pattern) {
      includes.push(pattern);
      if (expandDirectories && !pattern.endsWith("*")) {
        includes.push(`${pattern.replace(/\/$/, "")}/**`);
      }
    }
  }

  const matches = matchPaths(includes, {
    // TypeScript callers resolve relative matches against cwd. Next also accepts absolute roots.
    absolute: onlyDirectories ? absolute : Boolean(absolute),
    cwd,
    dot,
    ignore: excludes,
    follow: true,
    nocase: false,
    nodir: !onlyDirectories,
    mark: onlyDirectories,
  }).map((match) => match.split(sep).join("/"));

  return onlyDirectories
    ? matches.filter((match) => match.endsWith("/")).map((match) => match.slice(0, -1))
    : matches;
}

exports.globSync = globSync;
exports.isDynamicPattern = isDynamicPattern;
