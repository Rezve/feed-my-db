import { Knex } from 'knex';
import DatabaseConnection from './connection';
import { BrowserWindow } from 'electron';

export class DataInserter {
  public db: Knex;
  private shouldStopProcess: boolean;

  constructor(
    private DBConnection: DatabaseConnection,
    private batchSize: number,
    private concurrentBatches: number,
    private logInterval: number
  ) {
    this.db = this.DBConnection.getKnex();
    this.shouldStopProcess = false;
  }

  public stop() {
    this.shouldStopProcess = true;
  }

  private async insertSingleBatch(
    tableName: string,
    rows: any[],
    primaryKeyColumn: string
  ): Promise<{ count: number; keys: any[] }> {
    try {
      const result = await this.db(tableName)
        .insert(rows)
        .returning(`${primaryKeyColumn ?? '*'}`); // SQL Server OUTPUT clause

      const keys = result.map((row: any) => row[primaryKeyColumn]);
      return { count: rows.length, keys };
    } catch (error: any) {
      throw new Error(`Failed to insert batch into ${tableName}: ${error.message}`);
    }
  }

  public async insertAll(
    window: BrowserWindow,
    tableName: string,
    dataGenerator: () => any,
    totalRecords: number, // Per table
    primaryKeyColumn: string
  ): Promise<{ count: number; primaryKeys: any[] }> {
    this.shouldStopProcess = false;

    const totalBatches = Math.ceil(totalRecords / this.batchSize);
    let insertedRecords = 0;
    const primaryKeys: any[] = [];
    const batchPromises: Promise<{ count: number; keys: any[] }>[] = [];
    const startTime = Date.now();

    // Initial progress update
    this.sendProgressUpdate(window, {
      insertedRecords,
      totalRecords,
      percentage: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      currentBatch: 0,
      totalBatches,
    });

    for (let i = 0; i < totalBatches; i += this.concurrentBatches) {
      const currentBatchSize = Math.min(this.concurrentBatches, totalBatches - i);

      if (this.shouldStopProcess) {
        this.sendProgressUpdate(window, {
          insertedRecords,
          totalRecords,
          percentage: (insertedRecords / totalRecords) * 100,
          elapsedTime: (Date.now() - startTime) / 1000,
          estimatedTimeRemaining: 0,
          currentBatch: i,
          totalBatches,
          stopped: true,
        });
        break;
      }

      for (let j = 0; j < currentBatchSize; j++) {
        const batchIndex = i + j;
        const recordsToGenerate = Math.min(this.batchSize, totalRecords - batchIndex * this.batchSize);

        if (this.shouldStopProcess) {
          break;
        }

        if (recordsToGenerate > 0) {
          const rows = this.generateBatch(recordsToGenerate, dataGenerator);
          batchPromises.push(
            this.insertSingleBatch(tableName, rows, primaryKeyColumn).then(({ count, keys }) => {
              insertedRecords += count;
              primaryKeys.push(...keys);

              const elapsedTime = (Date.now() - startTime) / 1000;
              const percentage = (insertedRecords / totalRecords) * 100;
              const recordsPerSecond = insertedRecords / elapsedTime || 1;
              const estimatedTimeRemaining = (totalRecords - insertedRecords) / recordsPerSecond;

              if (batchIndex % this.logInterval === 0 || batchIndex === totalBatches - 1 || percentage === 100) {
                this.sendProgressUpdate(window, {
                  insertedRecords,
                  totalRecords,
                  percentage,
                  elapsedTime,
                  estimatedTimeRemaining,
                  currentBatch: batchIndex + 1,
                  totalBatches,
                });
              }
              return { count, keys };
            })
          );
        }
      }

      await Promise.all(batchPromises.splice(0));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    return { count: insertedRecords, primaryKeys };
  }

  private sendProgressUpdate(
    window: BrowserWindow,
    progress: {
      insertedRecords: number;
      totalRecords: number;
      percentage: number;
      elapsedTime: number;
      estimatedTimeRemaining: number;
      currentBatch: number;
      totalBatches: number;
      stopped?: boolean;
    }
  ) {
    window.webContents.send('app:progress', {
      insertedRecords: progress.insertedRecords,
      totalRecords: progress.totalRecords,
      percentage: progress.percentage.toFixed(2),
      elapsedTime: progress.elapsedTime.toFixed(1),
      estimatedTimeRemaining: progress.estimatedTimeRemaining.toFixed(1),
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
      stopped: progress.stopped || false,
      status: progress.stopped ? 'Stopped' : 'Processing',
    });
  }

  private generateBatch(recordsToGenerate: number, dataGenerator: () => any): any[] {
    const rows: any[] = [];
    for (let i = 0; i < recordsToGenerate; i++) {
      rows.push(dataGenerator());
    }
    return rows;
  }

  public async getTotalCount(tableName: string): Promise<number> {
    const result = await this.db(tableName).count('* as total').first();
    return Number(result?.total) || 0;
  }
}
