import { Knex } from "knex";
import { Sort } from "../repo.interface";

namespace Keys {
  export type StringKeys<TEntity extends {}> = {
    [key in keyof TEntity]: key extends string ? key : never;
  }[keyof TEntity];

  export type LiteralKeys<TEntity extends {}> = {
    [key in keyof TEntity]: TEntity[key] extends string | number | boolean
      ? key
      : never;
  }[keyof TEntity];

  export type StringArrayKeys<TEntity extends {}> = {
    [key in keyof TEntity]: TEntity[key] extends string[] ? key : never;
  }[keyof TEntity];

  export type ObjectKeys<TEntity extends {}> = {
    [key in keyof TEntity]: TEntity[key] extends Array<any>
      ? never
      : TEntity[key] extends Record<string, any>
      ? key
      : never;
  }[keyof TEntity];

  export type ObjectWithSnakeCaseKeys<TEntity extends {}> = {
    [key in Casing.CamelToSnakeCase<
      Keys.StringKeys<TEntity>
    >]: TEntity extends Record<Casing.SnakeToCamelCase<key>, infer TValue>
      ? TEntity[Casing.SnakeToCamelCase<key>]
      : never;
  };
}

namespace Casing {
  export type CamelToSnakeCase<S extends string> =
    S extends `${infer T}${infer U}`
      ? `${T extends Capitalize<T>
          ? "_"
          : ""}${Lowercase<T>}${CamelToSnakeCase<U>}`
      : S;

  export type SnakeToCamelCase<S extends string> =
    S extends `${infer T}_${infer U}`
      ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
      : S;
}

type IdSuffix<TKey> = TKey extends string ? `${TKey}Id` : never;

export type Model<T> = Prettify<
  T & {
    id: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
  }
>;

/**
 * A table type has:
 * - literals as they are ✅
 * - string arrays, turned into string ✅
 * - keys with object prop values turned into propId: string
 * - object arrays removed ✅
 * - timestamps ✅
 * - all camelCase keys in snake_case
 */
export type Table<TEntity extends {}> = Keys.ObjectWithSnakeCaseKeys<
  {
    [key in Keys.LiteralKeys<TEntity>]: TEntity[key];
  } & {
    [key in Keys.StringArrayKeys<TEntity>]: string;
  } & {
    [key in IdSuffix<Keys.ObjectKeys<TEntity>>]: string;
  } & {
    createdAt: string;
    updatedAt: string;
  }
>;

export namespace Table {
  type Timestamps = { created_at: string; updated_at: string };

  export type Insertable<TEntity extends Timestamps> = Omit<
    TEntity,
    "created_at" | "updated_at"
  > &
    Partial<Pick<TEntity, "created_at" | "updated_at">>;

  export type Updatable<TEntity extends Timestamps> = Omit<
    TEntity,
    "id" | "created_at"
  >;

  export type Composite<TEntity extends Timestamps> = Knex.CompositeTableType<
    TEntity,
    Insertable<TEntity>,
    Updatable<TEntity>
  >;
}

export type Archived = string | boolean;
export type Keys<TModel extends Model<{}>> = keyof TModel extends string
  ? keyof TModel
  : never;
export type Populate<TModel extends Model<{}>> = Keys<TModel> | Keys<TModel>[];
export type ExtendQuery<TModel extends Model<{}>> = {
  archived?: Archived;
  populate?: Populate<TModel>;
  sort?: Sort;
};
