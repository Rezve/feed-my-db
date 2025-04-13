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

      // Run the user code once
      const script = new vm.Script(wrappedCode);
      const context = vm.createContext(this.sandbox);
      script.runInContext(context);

      // Verify the function exists
      this.userFunctionToGenerateData = this.sandbox.exports.generateFakeData;
      if (!this.userFunctionToGenerateData || typeof this.userFunctionToGenerateData !== 'function') {
        window.webContents.send('app:code:result', {
          error: 'You must export a function named "generateFakeData"',
        });
        return;
      }

      // Generate data once and reply
      const fakeDataArray = Array.from({ length: 1 }, () => this.userFunctionToGenerateData());
      window.webContents.send('app:code:result', [
        {
          table: this.dbConfig.table,
          data: fakeDataArray,
        },
      ]);
      window.webContents.send('app:status', 'Data Schema Ready');
    } catch (error: any) {
      window.webContents.send('app:code:result', { error: error.message });
      window.webContents.send('app:status', `Error`);
    }
  }

  static async start(window: BrowserWindow, batchConfig: BatchConfig) {
    const logInterval = 10;
    if (!this.DB) {
      return;
    }

    if (!batchConfig.tableName) {
      window.webContents.send('app:log', { log: `🚫 Error: Please select a table before starting to insert data.` });
      window.webContents.send('app:complete', {});
      return;
    }

    try {
      window.webContents.send('app:status', 'Running');
      window.webContents.send('app:log', {
        log: `🚀 Starting bulk fake data generation for ${batchConfig.totalRecords} records...`,
      });
      window.webContents.send('app:log', {
        log: `🧪 Using schema: ${batchConfig.tableName}`,
      });
      window.webContents.send('app:log', {
        log: `🗂️ Generating in batches of ${batchConfig.batchSize}`,
      });
      const { tableName, totalRecords, batchSize, concurrentBatches } = batchConfig;
      this.inserter = new DataInserter(this.DB, totalRecords, batchSize, concurrentBatches, logInterval);
      await this.inserter.insertAll(window, tableName, this.userFunctionToGenerateData);
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
    return Object.values(result);
  }
}
