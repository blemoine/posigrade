class Success<T> {
    constructor(public readonly value: T) {
    }

    map<B>(mapper: (t:T) =>B): Success<B> {
        return new Success(mapper(this.value));
    }
}
class Failure<T> {
    constructor(public readonly messages: string[]) {
    }
    map<B>(_mapper: (t:T) =>B): Failure<B> {
        return this as any;
    }
}

export type Result<T> = Success<T> | Failure<T>