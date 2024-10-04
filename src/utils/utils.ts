import { EOL } from 'node:os';

type IsDefined = <T>(arg: T | undefined) => arg is T;
export const isDefined: IsDefined = arg => arg !== undefined;

type JoinAsLines = (...strList: string[]) => string;
export const joinAsLines: JoinAsLines = (...strList) => strList.join(EOL);
