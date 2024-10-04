type Optional<T> = T | undefined;

type Mapper<T, U> = (arg: T) => U;

type FMap = <T, U>(mapperFn: Mapper<T, U>, value: Optional<T>) => U | undefined;

const map: FMap = (fn, val) => val === undefined ? undefined : fn(val);

export {
  map,
};
