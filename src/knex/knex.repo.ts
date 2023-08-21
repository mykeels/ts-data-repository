import db, { Knex } from "knex";
import { IRepository } from "../repo.interface";
import { ExtendQuery, Model, Table } from "./knex.types";

db({}).transaction();
const makeError = (message: string, name?: string, cause?: any): Error => {
  const error = new Error(message);
  if (name) {
    error.name = name;
  }
  if (cause) {
    error.cause = cause;
  }
  return error;
};

export class KnexRepository<TModel extends Model<{}>, TModelName extends string>
  implements
    IRepository<
      Table.Composite<TModel>,
      Knex.Transaction<TModel>,
      Knex.QueryBuilder<Table.Composite<TModel>>,
      Table.Insertable<TModel>,
      Table.Updatable<TModel>,
      ExtendQuery<TModel>
    >
{
  query: Knex.QueryBuilder<Table.Composite<TModel>>;
  transaction: Knex.Transaction<TModel> | null;
  model: TModelName;

  constructor(
    model: TModelName,
    getQuery: (
      model: string
    ) => Knex.QueryBuilder<Table.Composite<TModel>> = db({})
  ) {
    this.query = getQuery(model);
    this.model = model;
    this.transaction = null;
  }

  /**
   * checks if the archived argument is either undefined
   * or passed as a false string in the cause of query params, and
   * converts it to a boolean.
   * @param archived string or boolean archived option
   */
  private convertArchived = (archived?: string | boolean) =>
    [undefined, "false", false, null].includes(archived) ? false : true;

  /**
   * Converts a passed condition argument to a query
   * @param condition string or object condition
   */
  private getQuery = (condition: string | Partial<TModel>) =>
    typeof condition === "string" ? { _id: condition } : { ...condition };

  getDBModel() {
    return this.model;
  }

  /**
   * Connects to a DB Transaction
   */
  connectDBSession(transaction: Knex.Transaction<TModel>) {
    this.transaction = transaction;
    return this;
  }

  /**
   * Disconnects from a DB Session
   */
  disconnectDBSession() {
    this.transaction = null;
    return this;
  }

  private withTransaction = (
    query: Knex.QueryBuilder<Table.Composite<TModel>>
  ) => {
    if (this.transaction) {
      return query.transacting(this.transaction);
    }
    return query;
  };

  /**
   * Creates one or more documents.
   */
  async create(
    attributes: Table.Insertable<TModel>
  ): Promise<Table.Composite<TModel>> {
    const [doc] = await this.withTransaction(
      this.query.insert(attributes, "*")
    );
    return doc;
  }

  /**
   * Finds a document by it's id
   * @throws a `ModelNotFoundError()` if the model is not found
   * @returns {Promise<TModel>}
   */
  async byID(
    id: string,
    options?: ExtendQuery<TModel>
  ): Promise<Table.Composite<TModel>> {
    const select = options?.populate || ["*"];
    const archived = this.convertArchived(options?.archived || false);
    this.query
      .where({
        id,
        ...(!archived
          ? { deleted_at: undefined }
          : { deleted_at: { $ne: undefined } }),
      })
      .select(...select)
      .then((result) => {
        if (!result) {
          return Promise.reject(
            makeError(`${this.name} not found`, "ModelNotFoundError")
          );
        }
        return result;
      });
    return (
      this.model
        // @ts-ignore
        .findOne({
          _id,
          ...(!archived
            ? { deleted_at: undefined }
            : { deleted_at: { $ne: undefined } }),
        })
        .session(this.session)
        .select(projections || [])
        .exec()
        .then((result) => {
          if (!result) {
            return Promise.reject(
              makeError(`${this.name} not found`, "ModelNotFoundError")
            );
          }
          return result;
        })
    );
  }

  /**
   * Finds a document by an object query.
   * @throws a `ModelNotFoundError()` if the model is not found
   */
  async byQuery(
    query: FilterQuery<TModel>,
    options?: ExtendQuery<TModel>
  ): Promise<HydratedDocument<TModel>> {
    let { projections, archived, populate, sort } = options || {};
    if (archived) {
      archived = this.convertArchived(archived);
    }
    return this.model
      .findOne({
        ...query,
        ...(!archived
          ? { deleted_at: undefined }
          : { deleted_at: { $ne: undefined } }),
      })
      .session(this.session)
      .select(projections || [])
      .populate(populate || [])
      .sort(sort)
      .exec()
      .then((result) => {
        if (!result) {
          return Promise.reject(
            makeError(`${this.name} not found`, "ModelNotFoundError")
          );
        } else {
          return result as HydratedDocument<TModel>;
        }
      });
  }

  /**
   * Counts documents matching a query.
   */
  async count(query: FilterQuery<TModel>): Promise<number> {
    return new Promise((resolve, reject) => {
      this.model
        .countDocuments(
          {
            ...query,
          },
          {},
          // @ts-expect-error
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        )
        .session(this.session);
    });
  }

  /**
   * Counts documents matching a query.
   */
  async distinct(
    field: Keys<TModel>,
    query: FilterQuery<TModel>
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.model
        .distinct(field, {
          ...query,
        })
        .session(this.session)
        // @ts-expect-error
        .exec((err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
    });
  }

  /**
   * Counts documents matching a query.
   */
  async countDistinct(
    field: Keys<TModel>,
    query: FilterQuery<TModel>
  ): Promise<number> {
    return this.distinct(field, query).then((ids) => ids.length);
  }

  /**
   * Returns true if a document exists, matching a query.
   */
  async exists(query: FilterQuery<TModel>): Promise<boolean> {
    return this.model.exists(query).then((result) => !!result);
  }

  /**
   * Finds all documents that match a query
   */
  async all(
    query: FilterQuery<TModel>,
    options?: ExtendQuery<TModel>
  ): Promise<HydratedDocument<TModel>[]> {
    const sort = options?.sort || DEFAULT_SORT;
    const archived = this.convertArchived(options?.archived || false);
    return this.model
      .find({
        ...query?.conditions,
        ...(!archived
          ? { deleted_at: undefined }
          : {
              $or: [
                { deleted_at: { $ne: undefined } },
                { deleted_at: undefined },
              ],
            }),
      })
      .session(this.session)
      .skip(query?.skip || 0)
      .limit(query?.limit || 0)
      .select(query?.projections || [])
      .populate(query?.populate || [])
      .sort(sort) as unknown as Promise<HydratedDocument<TModel>[]>;
  }

  /**
   * Same as `all()` but returns paginated results.
   */
  async paginate(
    pagination: PaginatedQuery<FilterQuery<TModel>>,
    options?: ExtendQuery<TModel>
  ): Promise<Paginated<HydratedDocument<TModel>>> {
    const query = pagination.query;
    const page = Number(pagination.page) - 1 || 0;
    const limit = Number(pagination.limit) || 20;
    const offset = page * limit;
    const sort = options?.sort || DEFAULT_SORT;
    const archived = this.convertArchived(options?.archived || false);
    const dbQuery = {
      ...query,
      ...(!archived
        ? { deletedAt: undefined }
        : { deletedAt: { $ne: undefined } }),
    };
    return Promise.all([
      this.count(dbQuery),
      new Promise((resolve, reject) => {
        this.model
          .find(dbQuery)
          .session(this.session)
          .limit(limit)
          .select(options?.projections || [])
          .populate(options?.populate || [])
          .skip(offset)
          .sort(sort)
          // @ts-expect-error
          .exec((err, result) => {
            if (err) return reject(err);
            resolve({
              page: {
                current: page + 1,
                prev: page > 0 ? page : null,
                next: page < Math.ceil(result.length / limit) ? page + 2 : null,
              },
              limit,
              sort,
              data: result,
            });
          });
      }) as Promise<
        Pick<Paginated<TModel>, "page" | "limit" | "sort" | "data">
      >,
    ]).then(
      ([count, result]) =>
        ({
          ...result,
          data: result.data,
          limit: result.limit,
          sort: result.sort,
          total: count,
          pages: Math.ceil(count / limit),
          page: result.page,
          offset: page * limit,
        } as Paginated<HydratedDocument<TModel>>)
    );
  }

  /**
   * Updates a single document that matches a particular condition.
   * Triggers mongoose `save` hooks.
   * @param condition Query condition to match against documents
   * @param update Instructions for how to update the document
   * @throws {ModelNotFoundError} a `ModelNotFoundError()` if the model is not found
   */
  async update(
    condition: FilterQuery<TModel>,
    update:
      | mongoose.UpdateWithAggregationPipeline
      | mongoose.UpdateQuery<TModel>
  ): Promise<HydratedDocument<TModel>> {
    const query = this.getQuery(condition);

    return this.model
      .findOne(query, null, { session: this.session })
      .then((result) => {
        if (!result) {
          return Promise.reject(
            makeError(`${this.name} not found`, "ModelNotFoundError")
          );
        }
        result.set(update);
        return result.save({ session: this.session });
      });
  }

  /**
   * Updates multiple documents that match a query
   * @param condition Query condition to match against documents
   * @param update Instructions for how to update the documents
   */
  async updateMany(
    condition: FilterQuery<TModel>,
    update:
      | mongoose.UpdateWithAggregationPipeline
      | mongoose.UpdateQuery<TModel>
  ): Promise<HydratedDocument<TModel>[]> {
    const query = this.getQuery(condition);

    return this.model
      .updateMany(query, update, { session: this.session })
      .then(() =>
        this.all({
          conditions: query,
        })
      );
  }

  /**
   * Soft deletes a document by created `deleted_at` field in the document and setting it to true.
   * @throws a `ModelNotFoundError()` if the model is not found
   */
  async softDelete(condition: FilterQuery<TModel>): Promise<TModel> {
    const query = this.getQuery(condition);

    const now = new Date();
    const old = (await this.byQuery(condition)) as TModel;
    old.deletedAt = now;
    return this.model
      .findOneAndUpdate(
        query,
        {
          deleted_at: new Date(),
        },
        {
          new: true,
          session: this.session,
        }
      )
      .then((result) => {
        if (!result) {
          return Promise.reject(
            makeError(`${this.name} not found`, "ModelNotFoundError")
          );
        } else {
          return old;
        }
      });
  }

  /**
   * Soft deletes a document by created `deleted_at` field in the document and setting it to true.
   * @throws a `ModelNotFoundError()` if the model is not found
   */
  async softDeleteMany(condition: FilterQuery<TModel>): Promise<TModel[]> {
    const query = this.getQuery(condition);

    const all = await this.all({
      conditions: query,
    });
    const deletedAt = new Date();

    return this.model
      .updateMany(
        query,
        {
          deleted_at: deletedAt,
        },
        {
          new: true,
          session: this.session,
        }
      )
      .then(() =>
        all.map((item) => {
          item.deletedAt = deletedAt;
          return item;
        })
      );
  }

  /**
   * Permanently deletes a document by removing it from the collection(DB)
   * @throws a `ModelNotFoundError()` if the model is not found
   */
  async delete(condition: FilterQuery<TModel>): Promise<void> {
    const query = this.getQuery(condition);
    await this.model.findOneAndDelete(query, {}).session(this.session);
  }

  /**
   * Permanently deletes multiple documents by removing them from the collection(DB)
   * @throws a `ModelNotFoundError()` if the model is not found
   */
  async deleteMany(condition: FilterQuery<TModel> = {}): Promise<void> {
    const query = this.getQuery(condition);
    await this.model.deleteMany(query, { session: this.session });
  }
}
