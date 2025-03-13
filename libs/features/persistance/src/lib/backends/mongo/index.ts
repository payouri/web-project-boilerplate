import { MongoClient, type ObjectId } from "mongodb"
import type { AnyZodObject, z } from "zod"
import type { BackendType, Collection } from "../types"

export type MongoId = string | ObjectId
export type StringMongoId = Extract<MongoId, string>
export type Document<Schema extends AnyZodObject> = z.infer<Schema> & {
    _id: MongoId
}
export type ResultDocument<Schema extends AnyZodObject> = Document<Schema> & {
    _id: StringMongoId
}
export type UnknownIdTypeDocument<Schema extends AnyZodObject> = Document<Schema> | ResultDocument<Schema>

export const MONGO_DB_BACKEND_TYPE: Extract<BackendType, "mongodb"> = "mongodb"

export type FindQueryParams<Schema extends AnyZodObject> = {
    filter?: Partial<z.infer<Schema>>
    sort?: Partial<{ [Prop in keyof z.infer<Schema>]: 1 | -1 }>
    limit?: number
    skip?: number
    projection?: Partial<{ [Prop in keyof z.infer<Schema>]: true | false }>
}

export type DeleteQueryParams<Schema extends AnyZodObject> = {
    filter: Partial<UnknownIdTypeDocument<Schema>>
}


export type Queries<Collections extends Record<string, Collection<string, AnyZodObject>>> = {
    [Collection in keyof Collections]: {
        findOne: (params: FindQueryParams<Collections[Collection]["schema"]>) => Promise<ResultDocument<Collections[Collection]["schema"]> | null>
        createOne: (data: z.infer<Collections[Collection]["schema"]>) => Promise<ResultDocument<Collections[Collection]["schema"]>>
        deleteOne: (params: DeleteQueryParams<Collections[Collection]["schema"]>) => Promise<void>
    }
}

export type MongoDbBackend<Collections extends Record<string, Collection<string, AnyZodObject>>> = {
    type: typeof MONGO_DB_BACKEND_TYPE
    dbName: string
    dbUri: string
    collections: Queries<Collections>
    client: MongoClient
}

const buildFindOneQuery = <Schema extends AnyZodObject>(dependencies: { mongoClient: MongoClient, dbName?: string, collectionName: string, schema: Schema }) => {
    const { mongoClient, dbName, schema, collectionName } = dependencies

    return async (params: FindQueryParams<Schema>): Promise<ResultDocument<Schema>> => {
        const { filter, sort, limit, skip, projection } = params
        const result = await mongoClient.db(dbName).collection(collectionName).findOne(filter ?? {}, {
            sort,
            limit,
            skip,
            projection,
        })

        if (!result) {
            return null
        }

        return Object.assign(schema.safeParse(result), {
            _id: result._id.toString(),
        })
    }
}

const buildCreateOneQuery = <Schema extends AnyZodObject>(dependencies: { mongoClient: MongoClient, dbName?: string, collectionName: string, schema: Schema }) => {
    const { mongoClient, dbName, schema, collectionName } = dependencies

    return async (data: z.infer<Schema>): Promise<ResultDocument<Schema>> => {

        const parsed = schema.parse(data)
        const result = await mongoClient.db(dbName).collection(collectionName).insertOne(schema.parse(parsed))

        return Object.assign(parsed, {
            _id: result.insertedId.toString(),
        })
    }
}

const buildDeleteOneQuery = <Schema extends AnyZodObject>(dependencies: { mongoClient: MongoClient, dbName?: string, collectionName: string }) => {
    const { mongoClient, dbName, collectionName } = dependencies

    return async (params: DeleteQueryParams<Schema>): Promise<void> => {
        const { filter } = params
        if (Object.keys(filter).length === 0) {
            throw new Error("Filter is required")
        }

        await mongoClient.db(dbName).collection(collectionName).deleteOne(filter)
    }
}

const buildQueryCollections = <Collections extends Record<string, Collection<string, AnyZodObject>>>(dependencies: { collections: Collections, mongoClient: MongoClient, dbName?: string }): Queries<Collections> => {
    const { collections, mongoClient, dbName } = dependencies
    return Object.fromEntries(
        Object.entries(collections).map(([collectionName, collection]): [string, Queries<Collections>[string]] => {
            return [
                collectionName, {
                    findOne: buildFindOneQuery({
                        mongoClient,
                        dbName,
                        collectionName,
                        schema: collection.schema,
                    }),
                    createOne: buildCreateOneQuery({
                        mongoClient,
                        dbName,
                        collectionName,
                        schema: collection.schema,
                    }),
                    deleteOne: buildDeleteOneQuery<typeof collection.schema>({
                        mongoClient,
                        dbName,
                        collectionName,
                    }),
                }]
        })) as Queries<Collections>

}

export const createMongoDbBackend = <Collections extends Record<string, Collection<string, AnyZodObject>>>(params: {
    dbName: string
    dbUri: string
    collections: Collections
}): MongoDbBackend<Collections> => {
    const { dbName, dbUri, collections } = params

    const client = new MongoClient(dbUri)

    return {
        type: MONGO_DB_BACKEND_TYPE,
        dbName,
        dbUri,
        collections: buildQueryCollections({
            collections,
            mongoClient: client,
            dbName,
        }),
        client,
    }
}