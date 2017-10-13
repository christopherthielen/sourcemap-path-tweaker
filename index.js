#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const yargs = require('yargs')

  .group(['include', 'exclude'], 'Sourcemap files (.js.map):')
  .option('include', {
    describe: 'Globs of sourcemaps to process',
    demandOption: true,
    array: true,
  })
  .option('exclude', {
    describe: 'Globs of sourcemaps to exclude',
    array: true,
  })

  .group(['prefix', 'auto'], 'The source path prefix to replace:')
  .option('prefix', {
    alias: ['p'],
    describe: 'Sets the source path prefix',
    string: true,
  })
  .option('auto', {
    alias: ['a'],
    describe: 'Auto detects the source path prefix',
    boolean: true,
  })

  .option('dryrun', {
    describe: 'Does not write changes to files but prints to stdout',
    default: false,
    boolean: true,
  })

  .check(argv => {
    if ((!argv.prefix && !argv.auto) || (argv.prefix && argv.auto)) {
      throw new Error('Specify either prefix or auto');
    }

    return true;
  })

  .usage('Usage: $0 [options]')
  .example('$0 --auto --include ./lib/**/*.js.map ./bundles/**/*.js.map --exclude ./lib/excluded.js.map')

const auto      = yargs.argv.auto;
const includes  = yargs.argv.include;
const excludes  = yargs.argv.exclude || [];
const prefix    = yargs.argv.prefix;
const normalize = yargs.argv.normalize;
const dryrun    = yargs.argv.dryrun;

const cwd = process.cwd();
const cwdString = path.dirname(fs.realpathSync(cwd));

const packageFile = findFile("package.json", cwd); 
const packageJson = JSON.parse(fs.readFileSync(packageFile));

const excludedFiles = excludes.map(globString => glob.sync(globString))
  .reduce((acc, arr) => acc.concat(arr), []);

const files = includes.map(globString => glob.sync(globString))
  .reduce((acc, arr) => acc.concat(arr), [])
  .filter(file => !excludedFiles.includes(file));

const parsedFiles = files.map(file => [file, JSON.parse(fs.readFileSync(file))]);
const allSources = sourcePaths(parsedFiles);
// start with identity map, where normalizedPaths['foo'] === 'foo';
let commonPrefix;
let normalizePaths = false;
let normalizedPaths = allSources.reduce((acc, file) => (acc[file] = file, acc), {});

if (auto) {
  // If any path contains "..", then normalize all paths
  if (allSources.some(src => /\.\./.exec(src))) {
    normalizePaths = true;
    normalizedPaths = parsedFiles.reduce((acc, [file, json]) => {
      json.sources.forEach(src => acc[src] = path.normalize(path.join(file, src)));
      return acc;
    }, {});
  }

  commonPrefix = autoDetectPrefix(values(normalizedPaths));
} else {
  commonPrefix = prefix;
}

parsedFiles.forEach(([file, json]) => {
  json.sources = json.sources.map(src => {
    const normalized = normalizedPaths[src];
    const matchesPrefix = normalized.startsWith(commonPrefix);
    const result = matchesPrefix ? path.join(packageJson.name, normalized.substring(commonPrefix.length)) : src;

    if (dryrun) {
      console.log(`${src} -> ${result}`);
    }

    return result;
  });

  if (!dryrun) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
  }
});

function values(obj) {
  return Object.keys(obj).map(key => obj[key]);
}

function sourcePaths(parsedFiles) {
  return parsedFiles
    .map(([file, json]) => json.sources)
    .reduce((acc, arr) => acc.concat(arr), []);
}

function newNode(char) {
  return { 
    char: char, 
    count: 0, 
    children: {}
  }
};

function trieInsert(node, string) {
  const char = string.substring(0, 1);
  const remaining = string.substring(1);
  const childNode = trieStore(node, char);
  if (remaining.length) trieInsert(childNode, remaining);
  return node;
}

function trieStore(node, char) {
  const child = node.children[char] = node.children[char] || newNode(char);
  child.count++;
  return child;
}

function autoDetectPrefix(strings) {
  if (strings.length < 2) return "";
  const sorted = strings.slice().sort();

  const trie = sorted.reduce(trieInsert, newNode(null));
  const total = sorted.length;
  const prefix = best(trie);

  function best(node) {
    const sorted = values(node.children).sort((a, b) => b.count - a.count);
    if (sorted[0].count / total > .9) {
      return (node.char || "") + best(sorted[0]);
    }
    return "";
  }

  console.log(`Auto detected${normalizePaths ? ' normalized' : ''} prefix: '${prefix}'`);

  return prefix;
}

function findFile(filename, dir) {
  const cfgFile = path.resolve(dir, filename);
  if (fs.existsSync(cfgFile))
    return cfgFile;

  const parentDir = path.resolve(dir, '..');
  if (parentDir === dir || !fs.existsSync(parentDir))
    throw new Error("Couldn't find " + filename);

  return findFile(filename, parentDir);
}

