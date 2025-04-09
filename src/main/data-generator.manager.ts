import { BatchConfig } from '../renderer/components/BatchConfig';
import DatabaseConnection from '../data-generator/connection';
import { BrowserWindow } from 'electron';
import { DataInserter } from '../data-generator/inserter';
import vm from 'vm';
import { faker } from '@faker-js/faker';

export class DataGeneratorManager {
  static dbConfig = {};
  static DB: DatabaseConnection;
  static inserter: DataInserter;
  static userFunctionToGenerateData: any;
  static sandbox = {
    require: (module: any) => {
      if (module === '@faker-js/faker') return { faker };
      throw new Error('Only @faker-js/faker is allowed');
    },
    module: { exports: {} }, // Mimic CommonJS module
    exports: {} as any, // Shortcut for module.exports
  };

  static async setDBConfig(window: BrowserWindow, event: any, dbConfig: any) {
    try {
      this.dbConfig = dbConfig;
      this.DB = DatabaseConnection.getInstance(this.dbConfig, true);
      await this.DB.getKnex().raw('SELECT 1;');
      window.webContents.send('app:status', 'Connected');

      const tables = await this.getTablesAndColumns();
      window.webContents.send('app:fetch-tables:result', { data: tables });

      return { success: true };
    } catch (error: any) {
      window.webContents.send('app:status', `Error - ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  static async setGeneratorFunction(window: BrowserWindow, userCode: any) {
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
      window.webContents.send('app:code:result', fakeDataArray);
      window.webContents.send('app:status', 'Generator Ready');
    } catch (error: any) {
      window.webContents.send('app:code:result', { error: error.message });
      window.webContents.send('app:status', `Error - ${error.message}`);
    }
  }

  static async start(window: BrowserWindow, batchConfig: BatchConfig) {
    if (!this.DB) {
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
      const { tableName, totalRecords, batchSize, concurrentBatches, logInterval } = batchConfig;
      this.inserter = new DataInserter(this.DB, totalRecords, batchSize, concurrentBatches, logInterval);
      await this.inserter.insertAll(window, tableName, this.userFunctionToGenerateData);
      window.webContents.send('app:log', { log: `✔️ Operation finished.` });
      window.webContents.send('app:complete', {});
      window.webContents.send('app:status', 'Complete');
    } catch (error: any) {
      window.webContents.send('app:log', {
        log: `⚠️ Operation failed with error: ${error.message}`,
      });
      window.webContents.send('app:status', `Error - ${error.message}`);
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
      .select('t.name as tableName', 'c.name as columnName', 'ty.name as dataType', 'c.max_length as maxLength')
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
        maxLength: row.maxLength === -1 ? 'MAX' : row.maxLength,
      });
    }

    return Object.values(result);
  }
}
