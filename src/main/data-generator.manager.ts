import { BatchConfig } from '../renderer/components/DataInsertionPanel';
import DatabaseConnection from '../data-generator/connection';
import { BrowserWindow } from 'electron';
import { DataInserter } from '../data-generator/inserter';
import vm from 'vm';
import { faker } from '@faker-js/faker';
import { loadConfig, saveConfig } from './storage';
import { getKey } from './setup-keychain';
import { encrypt } from './crypto';

export class DataGeneratorManager {
  static dbConfig = {} as any;
  static DB: DatabaseConnection;
  static inserter: DataInserter;
  static userFunctionToGenerateData: any;
  static sandbox = {
    require: (module: any) => {
      if (module === '@faker-js/faker') return { faker };
      throw new Error('Only @faker-js/faker is allowed');
    },
    module: { exports: {} },
    exports: {} as any,
  };

  static async connectToDatabaseAndSaveConfig(window: BrowserWindow, event: any, dbConfig: any) {
    try {
      this.dbConfig = dbConfig;
      this.DB = DatabaseConnection.getInstance(this.dbConfig, true);
      await this.DB.getKnex().raw('SELECT 1;');
      window.webContents.send('app:status', 'Connected');
      window.webContents.send('app:log', { log: '✅ Successfully connected to the database.' });

      const tables = await this.getTablesAndColumns();
      window.webContents.send('app:fetch-tables:result', { data: tables });

      // save user db configuration, if user choose to
      if (dbConfig.saveConnection) {
        if (dbConfig.password) {
          const key = await getKey('encryptionKey');
          if (!key) {
            return;
          }
          dbConfig.encryptedPassword = encrypt(dbConfig.password, key);
          delete dbConfig.password;
        }
        const currentConfig = await loadConfig();
        await saveConfig({ ...currentConfig, dbConfig });
      }

      window.webContents.send('app:connect:result', { success: true });
    } catch (error: any) {
      window.webContents.send('app:status', `Error`);
      window.webContents.send('app:connect:result', { success: false, message: error.message });
    }
  }

  static async setDataSchemaEditorPanel(window: BrowserWindow, userCode: any) {
    try {
      const wrappedCode = `
      (function (module, exports, require) {
          ${userCode}
          if (typeof generateFakeData === 'function') {
            exports.generateFakeData = generateFakeData;
          }
      })(module, exports, require);
    `;

      const script = new vm.Script(wrappedCode);
      const context = vm.createContext(this.sandbox);
      script.runInContext(context);

      this.userFunctionToGenerateData = this.sandbox.exports.generateFakeData;
      if (!this.userFunctionToGenerateData || typeof this.userFunctionToGenerateData !== 'function') {
        window.webContents.send('app:code:result', {
          error: 'You must export a function named "generateFakeData"',
        });
        return;
      }

      const sampleData = this.userFunctionToGenerateData();
      if (!sampleData || typeof sampleData !== 'object' || !Object.keys(sampleData).length) {
        window.webContents.send('app:code:result', {
          error: 'generateFakeData must return an object with table names as keys',
        });
        return;
      }

      // const data = Object.keys(sampleData).map((key: any) => sampleData[key]());

      window.webContents.send('app:code:result', [{ data: sampleData }]);
      window.webContents.send('app:status', 'Data Template Ready');
    } catch (error: any) {
      window.webContents.send('app:code:result', { error: error.message });
      window.webContents.send('app:status', `Error`);
    }
  }

  static async start(window: BrowserWindow, batchConfig: BatchConfig) {
    const logInterval = 10;
    if (!this.DB) {
      window.webContents.send('app:log', { log: `🚫 Error: Database connection not established.` });
      window.webContents.send('app:complete', {});
      return;
    }

    if (!batchConfig.tableNames || !batchConfig.tableNames.length) {
      window.webContents.send('app:log', { log: `🚫 Error: Please select at least one table.` });
      window.webContents.send('app:complete', {});
      return;
    }

    try {
      window.webContents.send('app:status', 'Running');
      window.webContents.send('app:log', {
        log: `🚀 Starting bulk fake data generation across ${batchConfig.tableNames.length} tables...`,
      });
      window.webContents.send('app:log', {
        log: `🧪 Using schemas: ${batchConfig.tableNames.join(', ')}`,
      });
      window.webContents.send('app:log', {
        log: `🗂️ Generating in batches of ${batchConfig.batchSize}`,
      });

      const schema = await this.getTablesAndColumns();
      const { tableNames, totalRecords, batchSize, concurrentBatches } = batchConfig;
      const sortedTables = this.sortTablesByDependencies(tableNames, schema.constraints);

      const insertedKeys: { [table: string]: any[] } = {};
      const uniqueValues: { [table: string]: { [column: string]: Set<string> } } = {};
      this.inserter = new DataInserter(this.DB, batchSize, concurrentBatches, logInterval);

      // Calculate total records across all tables for global progress
      const globalTotalRecords = Object.entries(totalRecords).reduce(
        (sum, [table, count]) => (tableNames.includes(table) ? sum + count : sum),
        0
      );
      let globalInsertedRecords = 0;
      const startTime = Date.now();

      await this.DB.getKnex().transaction(async (trx: any) => {
        for (const tableName of sortedTables) {
          const recordsForTable = totalRecords[tableName] || 100;
          window.webContents.send('app:log', {
            log: `📝 Processing ${recordsForTable} records for ${tableName}...`,
          });

          // Initialize unique value tracking
          uniqueValues[tableName] = {};
          const uniqueColumns = await this.getUniqueConstraintColumns(tableName, trx);
          uniqueColumns.forEach((col: string) => {
            uniqueValues[tableName][col] = new Set();
          });

          const dataGenerator = () => {
            let attempts = 0;
            const maxGenerateAttempts = 10;
            // const recordCounter = uniqueValues[tableName].recordCounter || 0;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // uniqueValues[tableName].recordCounter = recordCounter + 1;

            while (attempts < maxGenerateAttempts) {
              const data = this.userFunctionToGenerateData();
              const tableData = data[tableName];
              if (!tableData) {
                throw new Error(`No data generated for table ${tableName}`);
              }

              // Ensure unique email
              // if (uniqueColumns.includes('Email')) {
              //   tableData.Email = `user${recordCounter}@example.com`; // Or modify Faker email
              // }

              // Foreign keys
              const constraints = schema.constraints.filter((c: any) => c.ParentTable === tableName);
              constraints.forEach((constraint: any) => {
                const refTable = constraint.ReferencedTable;
                // const refColumn = constraint.ReferencedColumn;
                const parentColumn = constraint.ParentColumn;
                if (insertedKeys[refTable] && insertedKeys[refTable].length > 0) {
                  const randomKey = insertedKeys[refTable][Math.floor(Math.random() * insertedKeys[refTable].length)];
                  tableData[parentColumn] = randomKey;
                }
              });

              let isUnique = true;
              for (const col of uniqueColumns) {
                const value = tableData[col];
                if (value && uniqueValues[tableName][col].has(value)) {
                  isUnique = false;
                  break;
                }
              }
              if (isUnique) {
                uniqueColumns.forEach((col: string) => {
                  if (tableData[col]) {
                    uniqueValues[tableName][col].add(tableData[col]);
                  }
                });
                return tableData;
              }
              attempts++;
            }
            throw new Error(`Failed to generate unique data for ${tableName}`);
          };

          const primaryKeyColumn = await this.getPrimaryKeyColumn(tableName);
          this.inserter.db = trx;
          const { count, primaryKeys: tableKeys } = await this.inserter.insertAll(
            window,
            tableName,
            dataGenerator,
            recordsForTable,
            primaryKeyColumn
          );
          insertedKeys[tableName] = tableKeys;
          globalInsertedRecords += count;

          window.webContents.send('app:log', {
            log: `✔️ Inserted ${count} records for ${tableName}`,
          });

          // Global progress update
          const elapsedTime = (Date.now() - startTime) / 1000;
          const percentage = (globalInsertedRecords / globalTotalRecords) * 100;
          const recordsPerSecond = globalInsertedRecords / elapsedTime || 1;
          const estimatedTimeRemaining = (globalTotalRecords - globalInsertedRecords) / recordsPerSecond;

          window.webContents.send('app:progress', {
            insertedRecords: globalInsertedRecords,
            totalRecords: globalTotalRecords,
            percentage,
            elapsedTime,
            estimatedTimeRemaining,
            currentTable: tableName,
          });
        }
      });

      window.webContents.send('app:log', { log: `✔️ Operation finished.` });
      window.webContents.send('app:complete', {});
      window.webContents.send('app:status', 'Complete');
    } catch (error: any) {
      window.webContents.send('app:log', {
        log: `⚠️ Operation failed with error: ${error.message}`,
      });
      window.webContents.send('app:status', `Error`);
      window.webContents.send('app:complete', {});
    }
  }

  static async getUniqueConstraintColumns(tableName: string, db: any): Promise<string[]> {
    const result = await db
      .select('kcu.COLUMN_NAME')
      .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE as kcu')
      .join('INFORMATION_SCHEMA.TABLE_CONSTRAINTS as tc', {
        'tc.CONSTRAINT_NAME': 'kcu.CONSTRAINT_NAME',
        'tc.TABLE_NAME': 'kcu.TABLE_NAME',
      })
      .where({
        'kcu.TABLE_NAME': tableName,
        'tc.CONSTRAINT_TYPE': 'UNIQUE',
      });

    return result.map((row: any) => row.COLUMN_NAME);
  }

  static sortTablesByDependencies(tableNames: string[], constraints: any[]): string[] {
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    tableNames.forEach((table) => {
      graph.set(table, new Set());
      inDegree.set(table, 0);
    });

    constraints.forEach((constraint) => {
      if (tableNames.includes(constraint.ParentTable) && tableNames.includes(constraint.ReferencedTable)) {
        graph.get(constraint.ReferencedTable)!.add(constraint.ParentTable);
        inDegree.set(constraint.ParentTable, (inDegree.get(constraint.ParentTable) || 0) + 1);
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, table) => {
      if (degree === 0) queue.push(table);
    });

    const sorted: string[] = [];
    while (queue.length) {
      const table = queue.shift()!;
      sorted.push(table);
      graph.get(table)!.forEach((dependent) => {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      });
    }

    tableNames.forEach((table) => {
      if (!sorted.includes(table)) sorted.push(table);
    });

    return sorted;
  }

  static async getPrimaryKeyColumn(tableName: string): Promise<string> {
    const primaryKey = await this.DB.getKnex()
      .select({
        TableName: 't.name',
        ColumnName: 'c.name',
        ConstraintName: 'i.name',
      })
      .from('sys.tables as t')
      .join('sys.indexes as i', 't.object_id', 'i.object_id')
      .join('sys.index_columns as ic', function () {
        this.on('i.object_id', '=', 'ic.object_id').andOn('i.index_id', '=', 'ic.index_id');
      })
      .join('sys.columns as c', function () {
        this.on('ic.object_id', '=', 'c.object_id').andOn('ic.column_id', '=', 'c.column_id');
      })
      .where('i.is_primary_key', 1)
      .andWhere('t.name', tableName)
      .first();
    return primaryKey?.ColumnName;
  }
  // static async getPrimaryKeyColumn(tableName: string, db: any): Promise<string> {
  //   const result = await db
  //     .select('COLUMN_NAME')
  //     .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE')
  //     .where({
  //       TABLE_NAME: tableName,
  //       CONSTRAINT_NAME: db.raw(
  //         "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'",
  //         [tableName]
  //       ),
  //     })
  //     .first();

  //   if (!result || !result.COLUMN_NAME) {
  //     throw new Error(`No primary key found for table ${tableName}`);
  //   }
  //   return result.COLUMN_NAME;
  // }

  static stop(window: BrowserWindow) {
    this.inserter?.stop();
    window.webContents.send('app:log', {
      log: '🛑 User interrupted the operation. Exiting gracefully.',
    });
    window.webContents.send('app:status', 'Stopped');
  }

  static async sleep(sec: number) {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
  }

  static async getTablesAndColumns() {
    const knex = this.DB.getKnex();

    // Subquery to get unique columns
    const uniqueColumns = knex
      .select('ic.object_id', 'ic.column_id')
      .from('sys.indexes as i')
      .join('sys.index_columns as ic', function () {
        this.on('i.object_id', '=', 'ic.object_id').andOn('i.index_id', '=', 'ic.index_id');
      })
      .where('i.is_unique', 1)
      .groupBy('ic.object_id', 'ic.column_id');

    const rows = await knex
      .select(
        't.name as tableName',
        'c.name as columnName',
        'ty.name as dataType',
        'c.max_length as maxLength',
        'c.is_nullable as isNullable',
        'c.is_identity as isIdentity',
        knex.raw(`CASE WHEN uc.column_id IS NOT NULL THEN 1 ELSE 0 END as isUnique`)
      )
      .from('sys.columns as c')
      .join('sys.tables as t', 'c.object_id', 't.object_id')
      .join('sys.types as ty', 'c.user_type_id', 'ty.user_type_id')
      .leftJoin(knex.raw('(?) as uc', [uniqueColumns]), function () {
        this.on('c.object_id', '=', 'uc.object_id').andOn('c.column_id', '=', 'uc.column_id');
      })
      .where('t.is_ms_shipped', 0)
      .orderBy(['t.name', 'c.column_id']);

    const foreignKeys = await knex
      .select({
        ForeignKeyName: 'fk.name',
        ParentTable: 'tp.name',
        ParentColumn: 'cp.name',
        ReferencedTable: 'tr.name',
        ReferencedColumn: 'cr.name',
        OnDeleteAction: 'fk.delete_referential_action_desc',
      })
      .from('sys.foreign_keys as fk')
      .join('sys.foreign_key_columns as fkc', 'fk.object_id', 'fkc.constraint_object_id')
      .join('sys.tables as tp', 'fk.parent_object_id', 'tp.object_id')
      .join('sys.columns as cp', function () {
        this.on('fkc.parent_object_id', '=', 'cp.object_id').andOn('fkc.parent_column_id', '=', 'cp.column_id');
      })
      .join('sys.tables as tr', 'fk.referenced_object_id', 'tr.object_id')
      .join('sys.columns as cr', function () {
        this.on('fkc.referenced_object_id', '=', 'cr.object_id').andOn('fkc.referenced_column_id', '=', 'cr.column_id');
      });

    const result: Record<string, any> = {};

    for (const row of rows) {
      if (!result[row.tableName]) {
        result[row.tableName] = { name: row.tableName, columns: [] };
      }

      result[row.tableName].columns.push({
        name: row.columnName,
        type: row.dataType,
        isNullable: row.isNullable,
        isIdentity: row.isIdentity,
        isUnique: Boolean(row.isUnique),
        maxLength: row.maxLength === -1 ? 'MAX' : row.maxLength,
        foreignKey: foreignKeys.find((f) => f.ParentTable == row.tableName && f.ParentColumn == row.columnName),
      });
    }

    return { tables: Object.values(result), constraints: foreignKeys };
  }
}
