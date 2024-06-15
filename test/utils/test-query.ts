import * as assert from "assert";
// eslint-disable-next-line no-unused-vars
import query, { CompositeIndex } from "../../lib";

export default (
  collection: any[] | undefined | null,
  params: {
    query: string;
    parameters?: {
      name: string;
      value: any;
    }[];
    udf?: {
      [x: string]: any;
    };
    compositeIndexes?: CompositeIndex[][];
  },
  expected:
    | any
    | Error
    | {
        [x: string]: any;
      }
) => () => {
  const opts = {
    parameters: params.parameters,
    udf: params.udf,
    compositeIndexes: params.compositeIndexes
  };

  if (expected instanceof Error || expected.prototype instanceof Error) {
    assert.throws(
      () => query(params.query).exec(collection, opts),
      (err: Error) => {
        if (expected instanceof Error) {
          const e = expected as Error;
          return err.message === e.message && err.name === e.name;
        }
        return err instanceof expected || err.name === expected.name;
      }
    );
    return;
  }

  const { result } = query(params.query).exec(collection, opts);
  assert.deepStrictEqual(result, expected);
};
