import { useEffect, useState } from 'react';
import { IPCService } from '../services/ipc-service';
import { useNotification } from './notification/NotificationContext';

interface DBConfig {
  driver: string;
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  encrypt: boolean;
  trustServerCertificate: boolean;
  saveConnection: boolean;
}

interface DBConfigProps {
  isConnected: boolean;
  setIsConnected: (flag: boolean) => void;
}

const DBConfig: React.FC<DBConfigProps> = ({ isConnected, setIsConnected }: any) => {
  const [isDbConfigOpen, setIsDbConfigOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();

  // Database configuration state
  const [dbConfig, setDbConfig] = useState<DBConfig>({
    driver: '',
    host: 'localhost',
    user: 'test_user',
    password: '',
    database: 'Exp_Test',
    port: 1433,
    encrypt: false,
    trustServerCertificate: true,
    saveConnection: false,
  });

  const handleDbConfigChange = (field: keyof DBConfig, value: string | number | boolean) => {
    setDbConfig((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    async function loadData() {
      const config = await IPCService.loadConfig();
      if (!config) {
        setDbConfig({
          driver: '',
          host: '',
          user: '',
          password: '',
          database: '',
          port: 1433,
          encrypt: false,
          trustServerCertificate: true,
          saveConnection: false,
        });

        return;
      }

      setDbConfig(config as any);
    }

    window.electronAPI.on('app:connect:result', async (result) => {
      setIsLoading(false);
      if (result.success == true) {
        setIsConnected(true);
        addNotification('Successfully connected to the database', 'success');
        return;
      }
      addNotification(`Error: ${result.message}`, 'error');
    });

    loadData();
  }, []);

  const handleConnect = () => {
    setIsLoading(true);
    IPCService.connectToDatabase(dbConfig);
  };

  return (
    <div
      className={`db-config-section ${
        isDbConfigOpen ? 'open' : 'closed'
      } bg-white border border-gray-300 rounded-md shadow-sm`}
    >
      {/* Section Header */}
      <div className="section-header flex items-center justify-between p-2 bg-gray-200 border-b border-gray-300">
        <h2 className="text-sm font-semibold text-gray-800">Database Configuration</h2>
        <button
          className="toggle-btn w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors duration-200"
          onClick={() => setIsDbConfigOpen(!isDbConfigOpen)}
        >
          {isDbConfigOpen ? '-' : '+'}
        </button>
      </div>

      {/* Section Content (Visible when open) */}
      {isDbConfigOpen && (
        <div className="section-content p-4">
          <div className="config-grid grid grid-cols-1 mb-5">
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
              <select
                value={dbConfig.driver}
                onChange={(e) => handleDbConfigChange('driver', e.target.value)}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              >
                <option value="">Select Database</option>
                <option value="sqlserver">SQL Server</option>
                <option value="azuresql">Azure SQL</option>
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>
          </div>
          <div className="config-grid grid grid-cols-2 gap-4">
            {/* Host */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Host</label>
              <input
                placeholder="localhost"
                type="text"
                value={dbConfig.host}
                onChange={(e) => handleDbConfigChange('host', e.target.value)}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* User */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">User</label>
              <input
                placeholder="username"
                type="text"
                value={dbConfig.user}
                onChange={(e) => handleDbConfigChange('user', e.target.value)}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Password */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={dbConfig.password}
                onChange={(e) => handleDbConfigChange('password', e.target.value)}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Database */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
              <input
                placeholder="database_name"
                type="text"
                value={dbConfig.database}
                onChange={(e) => handleDbConfigChange('database', e.target.value)}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Port */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                placeholder="default port"
                type="number"
                value={dbConfig.port}
                onChange={(e) => handleDbConfigChange('port', parseInt(e.target.value))}
                disabled={isConnected}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Checkboxes */}
            <div className="config-item checkbox-item flex flex-col space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={dbConfig.encrypt}
                  onChange={(e) => handleDbConfigChange('encrypt', e.target.checked)}
                  disabled={isConnected}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:text-gray-400"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Encrypt</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={dbConfig.trustServerCertificate}
                  onChange={(e) => handleDbConfigChange('trustServerCertificate', e.target.checked)}
                  disabled={isConnected}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:text-gray-400"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">Trust Server Certificate</label>
              </div>
            </div>
            <div className="flex items-start space-x-2 mt-4">
              <input
                id="saveConnection"
                type="checkbox"
                checked={dbConfig.saveConnection}
                onChange={(e) => handleDbConfigChange('saveConnection', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="save-connection" className="text-sm text-gray-700">
                Save Connection Settings
              </label>
            </div>

            {/* Connect Button */}
            <div className="config-item flex items-end">
              <button
                className={`w-full py-2 px-4 text-sm font-semibold text-white rounded-md shadow-sm transition-colors duration-200 relative ${
                  isConnected
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                }`}
                disabled={isConnected || isLoading}
                onClick={handleConnect}
              >
                <span className={`${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                  {isConnected ? 'Connected' : 'Connect'}
                </span>

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DBConfig;
