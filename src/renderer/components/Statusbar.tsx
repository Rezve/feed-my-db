import { useEffect, useState } from 'react';
import { IPCService } from '../services/ipc-service';

const StatusBar: React.FC = () => {
  const [status, setStatus] = useState('Ready');
  const [version, setVersion] = useState('');

  useEffect(() => {
    const handleProgress = (status: any) => {
      setStatus(status);
    };
    window.electronAPI.on('app:status', handleProgress);
  }, []);

  useEffect(() => {
    const loadVersion = async () => {
      const version = await IPCService.getVersion();
      setVersion(version);
    };

    loadVersion();
  }, []);

  return (
    <div className="flex justify-between bg-gray-200 border-t border-gray-300 text-sm text-gray-600">
      <div className="pl-1">Status: {status ? status : 'Ready'}</div>
      {version && <div className="mr-5">v{version}</div>}
    </div>
  );
};

export default StatusBar;
