import { Knex } from 'knex';
import DatabaseConnection from './connection';
import { BrowserWindow } from 'electron';

export class DataInserter {
  private db: Knex;
  private shouldStopProcess: boolean;

  constructor(
    private DBConnection: DatabaseConnection,
    private totalRecords: number,
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

  private async insertSingleBatch(tableName: string, rows: any[]): Promise<number> {
    await this.db(tableName).insert(rows);
    return rows.length;
  }

  public async insertAll(window: BrowserWindow, tableName: string, userFunctionToGenerateData: any): Promise<number> {
    this.shouldStopProcess = false;

    const totalBatches = Math.ceil(this.totalRecords / this.batchSize);
    let insertedRecords = 0;
    const batchPromises: Promise<number>[] = [];
    const startTime = Date.now();

    // Initial progress update
    this.sendProgressUpdate(window, {
      insertedRecords,
      totalRecords: this.totalRecords,
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
          totalRecords: this.totalRecords,
          percentage: (insertedRecords / this.totalRecords) * 100,
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
        const recordsToGenerate = Math.min(this.batchSize, this.totalRecords - batchIndex * this.batchSize);

        if (this.shouldStopProcess) {
          break;
        }

        if (recordsToGenerate > 0) {
          const rows = this.generateBatch(recordsToGenerate, userFunctionToGenerateData);
          batchPromises.push(
            this.insertSingleBatch(tableName, rows).then((count) => {
              insertedRecords += count;

              // Calculate progress metrics
              const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
              const percentage = (insertedRecords / this.totalRecords) * 100;
              const recordsPerSecond = insertedRecords / elapsedTime;
              const estimatedTimeRemaining = (this.totalRecords - insertedRecords) / recordsPerSecond || 0;

              // Send update on every batch or at logInterval
              if (batchIndex % this.logInterval === 0 || batchIndex === totalBatches - 1 || percentage == 100) {
                this.sendProgressUpdate(window, {
                  insertedRecords,
                  totalRecords: this.totalRecords,
                  percentage,
                  elapsedTime,
                  estimatedTimeRemaining,
                  currentBatch: batchIndex + 1,
                  totalBatches,
                });
              }
              return count;
            })
          );
        }
      }

      await Promise.all(batchPromises.splice(0));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    return insertedRecords;
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

  private generateBatch(size: number, userFunctionToGenerateData: any): any[] {
    return Array.from({ length: size }, userFunctionToGenerateData);
  }

  public async getTotalCount(tableName: string): Promise<number> {
    const result = await this.db(tableName).count('* as total').first();
    return Number(result?.total) || 0;
  }
}
