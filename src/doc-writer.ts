import { EOL } from 'node:os';
import type { ConfigDocOptions, DocOptions, KeyDocOptions } from './types.js';
import { isDefined, joinAsLines, Optional } from './utils/index.js';

type Write = <T extends string>(documentOptions: DocOptions<T>) => string;

export const writeDoc: Write = ({ keyHeaders, header, description, configOptions, emptyValuePlaceholder }) => {
  const columnHeaders = makeHeaders(keyHeaders);
  const headerLine = makeHeaderLine(columnHeaders);
  const headerUnderLine = makeUnderHeaderLine(columnHeaders.length);

  const makeConfigDoc = makeConfigDocFactory({
    headerLine,
    headerUnderLine,
    emptyValuePlaceholder,
    dataKeys: Object.keys(keyHeaders),
  });

  return configOptions.reduce((doc, it) => doc.concat(makeConfigDoc(it)), makeDocHead({ header, description }));
};

type MakeHeaders = (optionKeyHeaders: Record<string, string>) => string[];
const makeHeaders: MakeHeaders = keyHeaders => ['key', ...Object.values(keyHeaders)];

type MakeHeaderLine = (columnNames: string[]) => string;
const makeHeaderLine: MakeHeaderLine = columnNames => `|${columnNames.join('|')}|`;

type MakeLine = (columnsCount: number) => string;
const makeUnderHeaderLine: MakeLine = length => `|${Array.from({ length }, () => '-').join('|')}|`;

type MakeHead = (options: Pick<DocOptions<string>, 'header' | 'description'>) => string;
const makeDocHead: MakeHead = ({ header, description }) =>
  `${makeHeader(header)}${EOL}${Optional.map(str => str?.concat(EOL), description) ?? ''}`;

type MakeHeader = (optionsHeader?: string) => string;
const makeHeader: MakeHeader = header => header ?? '## Configuration';

interface TableOptions<T extends string> {
  headerLine: string;
  headerUnderLine: string;
  emptyValuePlaceholder?: string;
  dataKeys: T[];
}

type MakeDocFactory = <T extends string>(params: TableOptions<T>) => (params: ConfigDocOptions<T>) => string;

const makeConfigDocFactory: MakeDocFactory = ({ headerLine, headerUnderLine, dataKeys, emptyValuePlaceholder }) =>
  ({ fileName, description, keyOptions }) => joinAsLines(...[
    isDefined(description) ? `### ${fileName} - ${description}` : `### ${fileName}`,
    ...(
      isDefined(keyOptions)
        ? [
          headerLine,
          headerUnderLine,
          makeConfigStructureDescription({ dataKeys, emptyValuePlaceholder }, keyOptions),
        ]
        : ['']
    ),
  ]);

type MakeDescription = <T extends string>(
  rowFactoryOptions: RowFactoryOptions,
  keyOptions: Record<string, KeyDocOptions<T>>
) => string;

const makeConfigStructureDescription: MakeDescription = (rowFactoryParams, opts) => {
  const makeRow = makeRowFactory(rowFactoryParams);

  return Object.entries(opts).reduce((doc, [key, params]) => doc.concat(makeRow(key, params)), '');
};

type RowFactoryOptions = Pick<TableOptions<string>, 'dataKeys' | 'emptyValuePlaceholder'>;
type MakeRowFactory = (options: RowFactoryOptions) => (key: string, options: KeyDocOptions<string>) => string;

const makeRowFactory: MakeRowFactory = ({ dataKeys, emptyValuePlaceholder }) => (key, options) =>
  `|${key}|${dataKeys.map(key => options[key] ?? emptyValuePlaceholder).join('|')}|${EOL}`;
