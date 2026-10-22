// 以 Pages CMS 原始碼模擬「後台開啟商品 → 儲存」的完整資料流程。
// 由 tests/pages-cms-roundtrip.mjs 用 esbuild 打包（@ 指向 Pages CMS 原始碼，UI 元件以空模組取代）。
// 對應原始碼（Pages CMS 2.1.8）：
//   讀取：app/api/[owner]/[repo]/[branch]/entries/[path]/route.ts → parseContent()
//   表單：components/entry/entry-form.tsx → initializeState(fields, sanitizeObject(contentObject))
//   儲存：app/api/[owner]/[repo]/[branch]/files/[path]/route.ts（zod 驗證 → writeFns → merge → sanitizeObject → stringify）
import { parse, stringify } from "@/lib/serialization";
import { deepMap, generateZodSchema, getSchemaByName, initializeState, sanitizeObject } from "@/lib/schema";
import { parseAndValidateConfig, normalizeConfig, parseConfig } from "@/lib/config";
import { readFns, writeFns } from "@/fields/registry";
import { ConfigSchema } from "@/lib/config-schema";
import mergeWith from "lodash.mergewith";

export function loadConfig(yamlText: string) {
  const { document, parseErrors, validationErrors } = parseAndValidateConfig(yamlText);
  const zod = ConfigSchema.safeParse(document.toJSON());
  const issues = zod.success ? [] : zod.error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`);
  const object = normalizeConfig(parseConfig(yamlText).document.toJSON());
  return { config: { object }, parseErrors, validationErrors, issues };
}

export function readEntry(config: any, name: string, fileText: string) {
  const schema = getSchemaByName(config.object, name);
  let contentObject = parse(fileText, { format: schema.format, delimiters: schema.delimiters });
  contentObject = deepMap(contentObject, schema.fields, (value: any, field: any) => {
    const type = field.type;
    if (typeof type === "string" && readFns[type]) return readFns[type](value, field, config);
    return value;
  });
  // 前端表單初始值
  const formValues = initializeState(schema.fields, sanitizeObject(contentObject));
  // 前端以 JSON 傳送（undefined 會被移除）
  return JSON.parse(JSON.stringify(formValues));
}

export function saveEntry(config: any, name: string, formValues: any, existingText: string, hasSha = true) {
  const schema = getSchemaByName(config.object, name);
  const contentFields = schema.fields;
  const zodSchema = generateZodSchema(contentFields);
  const zodValidation = zodSchema.safeParse(formValues);
  if (zodValidation.success === false) {
    const msgs = zodValidation.error.errors.map((e: any) => e.message + (e.path.length ? ` at ${e.path.join(".")}` : ""));
    return { ok: false, error: `Content validation failed: ${msgs.join(", ")}` };
  }
  const validated = deepMap(zodValidation.data, contentFields, (value: any, field: any) => {
    const fieldType = field.type as string;
    return writeFns[fieldType] ? writeFns[fieldType](value, field, config || {}) : value;
  });
  let finalContentObject = JSON.parse(JSON.stringify(validated));
  if (config?.object?.settings?.content?.merge && hasSha && !schema.list) {
    const existingContentObject = parse(existingText, { format: schema.format, delimiters: schema.delimiters });
    finalContentObject = mergeWith({}, existingContentObject, validated, (objValue: any, srcValue: any) => {
      if (Array.isArray(srcValue)) return srcValue;
    });
  }
  const text = stringify(sanitizeObject(finalContentObject), { format: schema.format, delimiters: schema.delimiters });
  return { ok: true, text };
}
