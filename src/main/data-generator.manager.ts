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
      window.webContents.send('app:log', { log: '✅ Successfully connected to the database. Ready to go!' });

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
      console.log('🚀 ~ DataGeneratorManager ~ setDataSchemaEditorPanel ~ sampleData:', sampleData);
      if (!sampleData || typeof sampleData !== 'object' || !Object.keys(sampleData).length) {
        window.webContents.send('app:code:result', {
          error: 'generateFakeData must return an object with table names as keys',
        });
        return;
      }

      const data = Object.keys(sampleData).map((key: any) => sampleData[key]());
      console.log('🚀 ~ DataGeneratorManager ~ setDataSchemaEditorPanel ~ data:', data);

      window.webContents.send('app:code:result', [{ data }]);
      window.webContents.send('app:status', 'Data Schema Ready');
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
      this.inserter = new DataInserter(this.DB, batchSize, concurrentBatches, logInterval);

      await this.DB.getKnex().transaction(async (trx: any) => {
        for (const tableName of sortedTables) {
          const recordsForTable = totalRecords[tableName] || 100; // Default if not specified
          window.webContents.send('app:log', {
            log: `📝 Processing ${recordsForTable} records for ${tableName}...`,
          });

          const dataGenerator = () => {
            const data = this.userFunctionToGenerateData();
            console.log('🚀 ~ DataGeneratorManager ~ dataGenerator ~ data:', data);
            const tableData = data[tableName]();
            console.log('🚀 ~ DataGeneratorManager ~ dataGenerator ~ tableData:', tableData);
            if (!tableData) {
              throw new Error(`No data generated for table ${tableName}`);
            }

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

            return tableData;
          };

          const primaryKeyColumn = await this.getPrimaryKeyColumn(tableName);
          this.inserter.db = trx; // Use transaction
          const result = await this.inserter.insertAll(
            window,
            tableName,
            dataGenerator,
            recordsForTable,
            primaryKeyColumn
          );
          insertedKeys[tableName] = result.primaryKeys;
          console.log('🚀 ~ DataGeneratorManager insertedKeys[tableName]:', insertedKeys[tableName]);

          window.webContents.send('app:log', {
            log: `✔️ Inserted ${result.count} records for ${tableName}`,
          });
        }
      });

      window.webContents.send('app:log', { log: `✔️ Operation finished.` });
      window.webContents.send('app:complete', {});
      window.webContents.send('app:status', 'Complete');
    } catch (error: any) {
      console.log('🚀 ~ DataGeneratorManager ~ start ~ error:', error);
      window.webContents.send('app:log', {
        log: `⚠️ Operation failed with error: ${error.message}`,
      });
      window.webContents.send('app:status', `Error`);
      window.webContents.send('app:complete', {});
    }
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
    const rows = await this.DB.getKnex()
      .select(
        't.name as tableName',
        'c.name as columnName',
        'ty.name as dataType',
        'c.max_length as maxLength',
        'c.is_nullable as isNullable',
        'c.is_identity as isIdentity'
      )
      .from('sys.columns as c')
      .join('sys.tables as t', 'c.object_id', 't.object_id')
      .join('sys.types as ty', 'c.user_type_id', 'ty.user_type_id')
      .orderBy(['t.name', 'c.column_id']);

    const foreignKeys = await this.DB.getKnex()
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

    // Transform rows into the desired structure
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
        maxLength: row.maxLength === -1 ? 'MAX' : row.maxLength,
      });
    }

    return { tables: Object.values(result), constraints: foreignKeys };
  }
}
