export type Model<T> = Prettify<
  T & {
    _id: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    deletedAt?: Date | string | null;
  }
>;
export type Projections<TModel extends Model<{}>> =
  import("mongoose").ProjectionType<TModel>;
export type Archived = string | boolean;
export type Keys<TModel extends Model<{}>> = keyof TModel extends string
  ? keyof TModel
  : never;
export type Populate<TModel extends Model<{}>> = Keys<TModel> | Keys<TModel>[];
