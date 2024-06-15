import * as continuationToken from "./continuation-token";
// eslint-disable-next-line no-unused-vars
import { CompositeIndex } from "./types";

const TYPE_ORDERS = new Set([
  "undefined",
  "null",
  "boolean",
  "number",
  "string",
  "array",
  "object"
]);

const typeOf = (v: any) => {
  const t = typeof v;
  if (t !== "object") return t;
  if (v === null) return "null";
  return Array.isArray(v) ? "array" : t;
};

const equalTypes = (a: any, b: any) => {
  const typeOfA = typeOf(a);
  const typeOfB = typeOf(b);
  return typeOfA === typeOfB && typeOfA !== "undefined";
};

const deepEqual = (a: any, b: any): boolean => {
  const typeOfA = typeOf(a);
  const typeOfB = typeOf(b);

  if (typeOfA === "array" && typeOfB === "array") {
    if ((a as Array<any>).length !== (b as Array<any>).length) return false;
    return a.every((v: any, i: number) => deepEqual(v, b[i]));
  }

  if (typeOfA === "object" && typeOfB === "object") {
    const aEntries = Object.entries(a);
    const bEntries = Object.entries(b);
    if (aEntries.length !== bEntries.length) return false;
    return aEntries.every(([k, v]) => deepEqual(v, b[k]));
  }

  return a === b;
};

const comparator = (a: any, b: any) => {
  if (a === b) return 0;

  const aType = typeOf(a);
  const bType = typeOf(b);

  if (aType === bType) {
    if (aType === "object") return 0;
    return a < b ? -1 : 1;
  }

  const typeOrders = [...TYPE_ORDERS];
  for (let i = 0; i < typeOrders.length; i += 1) {
    if (aType === typeOrders[i]) return -1;
    if (bType === typeOrders[i]) return 1;
  }

  return 0;
};

const getValue = (doc: any, [key, ...keys]: string[]): any => {
  const value = typeof doc === "object" && doc ? doc[key] : undefined;
  if (keys.length && typeof value !== "undefined") {
    return getValue(value, keys);
  }
  return value;
};

export const stripUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    // remove `undefined` from array unlike JSON
    return obj.reduce(
      (o, v) => (typeof v !== "undefined" ? [...o, stripUndefined(v)] : o),
      []
    );
  }

  if (obj && typeof obj === "object") {
    return Object.entries(obj).reduce(
      (o, [k, v]) => {
        if (typeof v !== "undefined") {
          // eslint-disable-next-line no-param-reassign
          o[k] = stripUndefined(v);
        }
        return o;
      },
      {} as any
    );
  }

  return obj;
};

export const equal = (a: any, b: any) => {
  if (typeof a === "undefined" || typeof b === "undefined") {
    return undefined;
  }

  if (!equalTypes(a, b)) {
    return false;
  }

  return deepEqual(a, b);
};

export const notEqual = (a: any, b: any) => {
  const eq = equal(a, b);
  return typeof eq !== "undefined" ? !eq : undefined;
};

export const compare = (operator: string, a: any, b: any) => {
  if (!equalTypes(a, b)) {
    return undefined;
  }

  const typeOfA = typeOf(a);
  if (typeOfA === "object" || typeOfA === "array") {
    return undefined;
  }

  switch (operator) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    default:
      throw new TypeError(`Unexpected operator: ${operator}`);
  }
};

export const and = (a: any, b: any) => {
  if (typeof a !== "boolean" || typeof b !== "boolean") {
    return a === false || b === false ? false : undefined;
  }

  return a && b;
};

export const or = (a: any, b: any) => {
  if (typeof a !== "boolean" || typeof b !== "boolean") {
    return a === true || b === true ? true : undefined;
  }

  return a || b;
};

export const not = (v: any) => (typeof v === "boolean" ? !v : undefined);

export const calculate = (operator: string, a: any, b: any) => {
  if (typeof a !== "number" || typeof b !== "number") {
    return undefined;
  }

  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return a / b;
    case "%":
      return a % b;
    case "|":
      // eslint-disable-next-line no-bitwise
      return a | b;
    case "&":
      // eslint-disable-next-line no-bitwise
      return a & b;
    case "^":
      // eslint-disable-next-line no-bitwise
      return a ^ b;
    case "<<":
      // eslint-disable-next-line no-bitwise
      return a << b;
    case ">>":
      // eslint-disable-next-line no-bitwise
      return a >> b;
    case ">>>":
      // eslint-disable-next-line no-bitwise
      return a >>> b;
    default:
      throw new TypeError(`Unexpected operator: ${operator}`);
  }
};

export const calculateUnary = (operator: string, v: any) => {
  if (typeof v !== "number") {
    return undefined;
  }

  switch (operator) {
    case "+":
      return +v;
    case "-":
      return -v;
    case "~":
      // eslint-disable-next-line no-bitwise
      return ~v;
    default:
      throw new TypeError(`Unexpected operator: ${operator}`);
  }
};

export const concat = (a: any, b: any) =>
  typeof a === "string" && typeof b === "string" ? a + b : undefined;

export const sort = (
  collection: {
    [x: string]: any;
  }[],
  getRid: (a: any) => any,
  compositeIndexes?: CompositeIndex[][],
  ...orders: [any[], boolean][]
) => {
  if (orders.length > 1 && compositeIndexes) {
    const found = compositeIndexes.some(indexes => {
      if (indexes.length !== orders.length) return false;

      return indexes.every((index, i) => {
        const [keys, desc] = orders[i];
        const path = `/${keys.slice(1).join("/")}`;
        const order = desc ? "descending" : "ascending";
        return path === index.path && order === index.order;
      });
    });

    if (!found) {
      throw new Error(
        "The order by query does not have a corresponding composite index that it can be served from."
      );
    }
  }

  const sorted = collection.slice().sort((a, b) => {
    for (let i = 0, l = orders.length; i < l; i += 1) {
      const [keys, desc] = orders[i];
      const aValue = getValue(a, keys);
      const bValue = getValue(b, keys);
      const r = comparator(aValue, bValue);
      if (r !== 0) return desc ? -r : r;
    }

    // sort by `_rid`
    const rid1 = getRid(a);
    const rid2 = getRid(b);
    return comparator(rid1, rid2);
  });

  if (orders.length !== 1) return sorted;

  const [keys] = orders[0];
  return sorted.filter(d => typeof getValue(d, keys) !== "undefined");
};

export const paginate = (
  collection: [{ [x: string]: any }, { [x: string]: any }][],
  maxItemCount?: number,
  continuation?: { token: string },
  getRid?: (a: any) => any,
  ...orders: [any[], boolean][]
) => {
  let result = collection;
  let token: continuationToken.Token;
  let offset = 0;

  if (continuation) {
    token = continuationToken.decode(continuation.token);

    let src = 0;
    let index = result.findIndex(([, d]) => {
      if (typeof token.RTD !== "undefined" && orders.length) {
        for (let i = 0, l = orders.length; i < l; i += 1) {
          const [keys, desc] = orders[i];
          const rtd = getValue(d, keys);
          const r = comparator(rtd, token.RTD[i]) * (desc ? -1 : 1);
          if (r < 0) return false;
          if (r > 0) return true;
        }
      }

      const rid = getRid(d);
      if (!rid) {
        throw new Error(
          "The _rid field is required on items for the continuation option."
        );
      }
      if (comparator(rid, token.RID) < 0) return false;
      if (!token.SRC || rid !== token.RID) return true;
      if (src === token.SRC) return true;
      src += 1;
      return false;
    });

    index = index >= 0 ? index : result.length;
    result = result.slice(index);
    offset += index;
  }

  let nextContinuation: {
    token: string;
    range: { min: string; max: string };
  } | null = null;
  if (maxItemCount > 0) {
    if (result.length > maxItemCount) {
      const [, item] = result[maxItemCount];
      const RID = getRid(item);
      if (!RID) {
        throw new Error(
          "The _rid field is required on items for the maxItemCount option."
        );
      }
      const RT = (token ? token.RT : 0) + 1;
      const TRC = (token ? token.TRC : 0) + maxItemCount;
      const RTD = orders.length
        ? orders.map(([keys]) => getValue(item, keys))
        : undefined;

      // calculate "SRC" which is the offset of items with the same `_rid`;
      let j = offset + maxItemCount - 1;
      for (; j >= 0; j -= 1) {
        if (getRid(collection[j][1]) !== RID) break;
      }
      const SRC = offset + maxItemCount - j - 1;

      const nextToken = continuationToken.encode({ RID, RT, SRC, TRC, RTD });

      nextContinuation = {
        token: nextToken,
        range: { min: "", max: "FF" }
      };
    }

    result = result.slice(0, maxItemCount);
  }

  return {
    result: stripUndefined(result.map(([r]) => r)),
    continuation: nextContinuation
  };
};

export const exists = (rows: any[]) =>
  rows.length > 1 ? true : typeof rows[0] !== "undefined";
