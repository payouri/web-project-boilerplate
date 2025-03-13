import type { AnyZodObject } from "zod"

export type BackendType = "fs" | "memory" | "mongodb" | "postgres"

export type Collection<Name extends string, Schema extends AnyZodObject> = {
    name: Name
    schema: Schema
}