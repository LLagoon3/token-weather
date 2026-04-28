import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const snapshotSchema = JSON.parse(
  readFileSync(join(__dirname, '../usage-snapshot.schema.json'), 'utf8'),
);
const eventSchema = JSON.parse(readFileSync(join(__dirname, '../usage-event.schema.json'), 'utf8'));

/**
 * Lightweight zero-dependency JSON Schema validator.
 *
 * 지원 범위 (이 프로젝트의 스키마에 사용되는 기능만):
 *   - type (string / number / integer / boolean / object / array / null, union 포함)
 *   - required
 *   - enum
 *   - properties + additionalProperties
 *   - items (array)
 *   - format: date-time (ISO 8601 기본 검증)
 *
 * 미지원 (불필요):
 *   - $ref, allOf, anyOf, oneOf, if/then/else, pattern, minLength 등
 */

/**
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUsageSnapshot(data) {
  return validateAgainstSchema(data, snapshotSchema, '');
}

/**
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUsageEvent(data) {
  return validateAgainstSchema(data, eventSchema, '');
}

function validateAgainstSchema(data, schema, path) {
  const errors = [];
  validateNode(data, schema, path, errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(data, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  // type check
  if (schema.type) {
    if (!matchesType(data, schema.type)) {
      errors.push(
        `${path || '(root)'}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(data)}`,
      );
      return;
    }
  }

  // enum check
  if (schema.enum) {
    if (!schema.enum.includes(data)) {
      errors.push(
        `${path || '(root)'}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`,
      );
    }
  }

  // format: date-time (basic)
  if (schema.format === 'date-time' && typeof data === 'string') {
    if (Number.isNaN(Date.parse(data))) {
      errors.push(`${path}: invalid date-time format "${data}"`);
    }
  }

  // object checks
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push(`${path || '(root)'}: missing required field "${key}"`);
        }
      }
    }

    // properties
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          validateNode(data[key], subSchema, `${path}.${key}`, errors);
        }
      }
    }

    // additionalProperties: false
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push(`${path || '(root)'}: unexpected property "${key}"`);
        }
      }
    }
  }

  // array checks
  if (Array.isArray(data) && schema.items) {
    for (let i = 0; i < data.length; i++) {
      validateNode(data[i], schema.items, `${path}[${i}]`, errors);
    }
  }
}

function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  const actual = typeOf(value);
  return types.some((t) => {
    if (t === 'null') return value === null;
    if (t === 'integer') return typeof value === 'number' && Number.isInteger(value);
    if (t === 'number') return typeof value === 'number';
    if (t === 'array') return Array.isArray(value);
    return actual === t;
  });
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
