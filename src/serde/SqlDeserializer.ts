import {Result} from "../result/Result";

export type SqlDeserializer<T> = {
    deserialize(row: {[key:string]: unknown}): Result<T>;
}