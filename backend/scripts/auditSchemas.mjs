// Read-only schema/index audit. No database connection unless --live is supplied.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (/\.js$/.test(name) && /[\\/]models[\\/]|[\\/](?:models|\w+Models)\.js$/.test(name)) files.push(name);
  }
}
await walk(root);
const registrations = new Map();
const definitions = [];
const register = mongoose.model.bind(mongoose);
const issues = [];
mongoose.model = function (name, schema, ...args) {
  if (schema) {
    definitions.push({ modelName: name, schema, file: loading, collection: { name: args[0] || schema.options.collection || mongoose.pluralize()(name) } });
    const previous = registrations.get(name);
    if (previous && previous.schema !== schema) issues.push({ kind: 'model-redefinition', model: name, first: previous.file, second: loading });
    registrations.set(name, { schema, file: loading });
  }
  return register(name, schema, ...args);
};
let loading = '';
const declarations = new Map();
for (const file of files.sort()) {
  loading = path.relative(root, file).replaceAll('\\', '/');
  const source = await fs.readFile(file, 'utf8');
  for (const match of source.matchAll(/mongoose\.model\(\s*["']([^"']+)["']\s*,/g)) {
    const declaredIn = declarations.get(match[1]) || [];
    declaredIn.push(loading);
    declarations.set(match[1], declaredIn);
  }
  try { await import(pathToFileURL(file)); }
  catch (error) { issues.push({ kind: 'import-error', file: loading, message: error.message }); }
}
mongoose.model = register;
for (const [model, declaredIn] of declarations) {
  if (declaredIn.length > 1 && !issues.some(issue => issue.kind === 'model-redefinition' && issue.model === model)) issues.push({ kind: 'multiple-model-declarations', model, files: declaredIn });
}
const models = definitions;
for (const model of models) {
  const indexes = model.schema.indexes();
  const seen = new Set();
  for (const [key, options] of indexes) {
    const signature = JSON.stringify(key);
    if (seen.has(signature)) issues.push({ kind: 'duplicate-schema-index', model: model.modelName, key });
    seen.add(signature);
    for (const field of Object.keys(key)) {
      if (!model.schema.path(field) && !model.schema.nested[field] && !field.includes('$**')) issues.push({ kind: 'index-unknown-path', model: model.modelName, field });
    }
  }
  function inspectPaths(schema, prefix = '', ancestors = new Set()) {
    if (ancestors.has(schema)) return;
    const visited = new Set([...ancestors, schema]);
    schema.eachPath((pathName, field) => {
    const name = prefix + pathName;
    const ref = field.options.ref || field.caster?.options?.ref || field.$embeddedSchemaType?.options?.ref;
    if (typeof ref === 'string' && !mongoose.models[ref]) issues.push({ kind: 'unregistered-reference', model: model.modelName, field: name, ref });
    const value = field.options.default;
    if (value !== undefined && typeof value !== 'function' && field.enumValues?.length && !field.enumValues.includes(value)) issues.push({ kind: 'default-outside-enum', model: model.modelName, field: name });
    if (field.schema) inspectPaths(field.schema, name + '.', visited);
    });
  }
  inspectPaths(model.schema);
  for (const [hook, handlers] of model.schema.s.hooks._pres) {
    for (const handler of handlers) {
      if (/^(?:async\s+)?function[^()]*\(\s*next\b/.test(handler.fn.toString())) issues.push({ kind: 'callback-pre-hook', model: model.modelName, hook, file: model.file });
    }
  }
}
if (process.argv.includes('--live')) {
  dotenv.config({ path: path.join(root, '.env'), quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for --live');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000, ...(process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {}) });
    for (const model of models) {
      let actual;
      try { actual = await mongoose.connection.db.collection(model.collection.name).indexes(); }
      catch (error) {
        issues.push({ kind: error.code === 26 ? 'collection-missing' : 'index-read-error', model: model.modelName, message: error.code === 26 ? undefined : error.message });
        continue;
      }
      for (const [key, options] of model.schema.indexes()) {
        const matches = actual.filter(index => JSON.stringify(index.key) === JSON.stringify(key));
        const compatible = matches.some(index => Boolean(index.unique) === Boolean(options.unique) && Boolean(index.sparse) === Boolean(options.sparse) && JSON.stringify(index.partialFilterExpression) === JSON.stringify(options.partialFilterExpression) && index.expireAfterSeconds === options.expireAfterSeconds);
        if (!compatible) issues.push({ kind: matches.length ? 'index-options-mismatch' : 'index-missing', model: model.modelName, key, expected: options, actual: matches });
      }
    }
  } finally { await mongoose.disconnect(); }
}
const summary = { files: files.length, models: new Set(models.map(model => model.modelName)).size, schemaDefinitions: models.length, live: process.argv.includes('--live'), issueCounts: Object.fromEntries([...new Set(issues.map(i => i.kind))].map(kind => [kind, issues.filter(i => i.kind === kind).length])) };
const report = { summary, issues };
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (output) await fs.writeFile(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(output ? summary : report, null, 2));
