import { useEffect, useRef, useState } from "react";
import LogSectionWithIPC from "../elements/ProgressBar";

interface LogEntry {
    id: number;
    timestamp: string;
    message: string;
  }


const LiveLog: React.FC = () => {
    const [isLogsOpen, setIsLogsOpen] = useState(true);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    const addLog = (message: string) => {
      setLogs(prev => [...prev, {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        message
      }]);
    };

     useEffect(() => {
      const handleProgress = (data: any) => {
        addLog(data.log)
      };
      window.electronAPI.on('app:log', handleProgress);
    }, []);

    useEffect(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, [logs]);

    return (
      <div
        className={`log-section ${
          isLogsOpen ? 'open' : 'closed'
        } bg-white border border-gray-300 rounded-md shadow-sm`}
      >
        {/* Section Header */}
        <div className="section-header flex items-center justify-between p-2 bg-gray-200 border-b border-gray-300">
          <h2 className="text-sm font-semibold text-gray-800">Live Logs & Progress</h2>
          <button
            className="toggle-btn w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors duration-200"
            onClick={() => setIsLogsOpen(!isLogsOpen)}
          >
            {isLogsOpen ? '-' : '+'}
          </button>
        </div>
  
        {/* Section Content */}
        {isLogsOpen && (
          <div className="section-content flex flex-col md:flex-row">
            {/* Left Half: Logs */}
            <div className="w-full md:w-1/2 p-4 border-r border-gray-300">
              <div
                className="log-container bg-white rounded-md h-64 overflow-y-auto"
                ref={logContainerRef}
              >
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="log-entry flex space-x-2 text-sm border-b border-gray-200 py-1 last:border-b-0 px-2"
                  >
                    <span className="timestamp text-gray-500 font-mono min-w-[120px]">
                      {log.timestamp}
                    </span>
                    <span className="message text-gray-800">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Half: Progress */}
            <div className="w-full md:w-1/2 p-4">
              <LogSectionWithIPC />
            </div>
          </div>
        )}
      </div>
    );
  };

export default LiveLog;