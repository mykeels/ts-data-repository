export type SortOrder = -1 | 1 | "asc" | "ascending" | "desc" | "descending";

export type Sort = { [key: string]: SortOrder } | undefined | null;

interface ISessionRepository<TSession> {
  connectDBSession(session: TSession): this;
  disconnectDBSession(): this;
}

interface IWritableRepository<
  TModel extends {},
  TSession,
  TQueryable,
  TUpdatable
> extends ISessionRepository<TSession> {
  create(attributes: Partial<TModel>): Promise<TModel>;
  update(condition: TQueryable, update: TUpdatable): Promise<TModel>;
  updateMany(condition: TQueryable, update: TUpdatable): Promise<TModel[]>;
  softDelete(condition: TQueryable): Promise<TModel>;
  softDeleteMany(condition: TQueryable): Promise<TModel[]>;
  delete(condition: TQueryable): Promise<void>;
  deleteMany(condition: TQueryable): Promise<void>;
}

interface IReadableRepository<
  TModel extends {},
  TSession,
  TQueryable,
  TExtendQueryable
> extends ISessionRepository<TSession> {
  byID(_id: string, options?: TQueryable): Promise<TModel>;
  byQuery(query: TQueryable, options?: TExtendQueryable): Promise<TModel>;
  count(query: TQueryable): Promise<number>;
  distinct(field: keyof TModel, query: TQueryable): Promise<string[]>;
  countDistinct(field: keyof TModel, query: TQueryable): Promise<number>;
  exists(query: TQueryable): Promise<boolean>;
  all(query: TQueryable, options?: TExtendQueryable): Promise<TModel[]>;
  paginate(
    query: PaginatedQuery<TQueryable>,
    options?: TExtendQueryable
  ): Promise<Paginated<TModel>>;
}

export interface IRepository<
  TModel extends {},
  TSession,
  TQueryable,
  TUpdatable,
  TExtendQueryable
> extends IReadableRepository<TModel, TSession, TQueryable, TExtendQueryable>,
    IWritableRepository<TModel, TSession, TQueryable, TUpdatable> {}

export type Paginated<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  pages: number;
  page: {
    current: number;
    next: number | null;
    prev: number | null;
  };
  sort: Sort;
};

export type PaginatedQuery<TQueryable> = {
  query: TQueryable;
  skip?: number;
  limit?: number;
  page?: number;
};
