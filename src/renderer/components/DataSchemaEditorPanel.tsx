import { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface DataSchemaEditorPanelProps {
  code: string;
  setCode: (code: string) => void;
  isConnected: boolean;
  isCodeConfirmed: boolean;
  setCodeConfirmed: (flag: boolean) => void;
  openTableConfigModal: (flag: boolean) => void;
}

const DataSchemaEditorPanel: React.FC<DataSchemaEditorPanelProps> = ({
  isConnected,
  isCodeConfirmed,
  setCodeConfirmed,
  openTableConfigModal,
  code,
  setCode,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [sampleData, setSampleData] = useState<any[] | null>(null);
  const [hasCodeChanged, setHasCodeChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReadyAnimation, setShowReadyAnimation] = useState(false);

  useEffect(() => {
    window.electronAPI.on('app:code:result', (result) => {
      if (result.error) {
        setError(result.error);
        setSampleData(null);
      } else {
        setSampleData(result);
        setError(null);

        setCodeConfirmed(true);
        // setConfirmButtonText('Confirmed');
        setHasCodeChanged(false);
      }
    });
  }, []);

  useEffect(() => {
    if (isConnected && !showReadyAnimation) {
      setShowReadyAnimation(true);
      setTimeout(() => setShowReadyAnimation(false), 5 * 1000);
    }
  }, [isConnected]);

  const handleRunCode = () => {
    setError(null);
    setSampleData(null);
    window.electronAPI.send('app:code', code);
  };

  const handleColumnConfiguration = () => {
    setHasCodeChanged(true);
    openTableConfigModal(true);
  };

  const renderTable = (tableData: any, index: number) => {
    const { data } = tableData;
    return (
      <div key={index} className="mb-4">
        {Object.entries(data as { string: any[] }).map(([key, value]) => {
          return (
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-2">Table: {key}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <tbody>
                    {/* TODO: Add support for multi table and remove 0 index */}
                    {Object.entries(value).map(([key, value]) => {
                      return (
                        <tr key={key} className="border-b border-gray-300">
                          <td className="p-2 font-semibold border-r border-gray-300">{key}</td>
                          <td className="p-2">{value instanceof Date ? value.toISOString() : String(value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`editor-section ${isEditorOpen ? 'open' : 'closed'} bg-white border border-gray-300 rounded-md shadow-sm relative ${
        showReadyAnimation ? 'animate-border-pulse' : ''
      }`}
    >
      <div className={`relative ${!isConnected ? '' : ''}`}>
        <div className="section-header flex items-center justify-between p-2 bg-gray-200 border-b border-gray-300">
          <h2 className="text-sm font-semibold text-gray-800">Data Template Editor</h2>
          <button
            className="toggle-btn w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors duration-200"
            onClick={() => setIsEditorOpen(!isEditorOpen)}
          >
            {isEditorOpen ? '-' : '+'}
          </button>
        </div>

        {isEditorOpen && (
          <div className="section-content p-4 flex gap-4">
            {/* Editor */}
            <div className="w-1/2 flex flex-col gap-4">
              <div className="editor-container bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden">
                <MonacoEditor
                  height="40vh"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(value) => {
                    setCode(value || '');
                    if (isCodeConfirmed && !hasCodeChanged) {
                      setHasCodeChanged(true);
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily: "'Consolas', 'Courier New', monospace",
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>

              <div className="flex items-center">
                <button
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${!isConnected ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                  onClick={handleRunCode}
                  disabled={!isConnected}
                >
                  Preview Script
                </button>
                <button
                  className={`px-4 ml-5 py-2 text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                    ${!isConnected ? ' bg-gray-400 cursor-not-allowed' : ' bg-gray-600 hover:bg-gray-700'}
                    `}
                  onClick={handleColumnConfiguration}
                  disabled={!isConnected}
                >
                  Edit Template
                </button>

                {!isConnected && (
                  <div className="ml-5 text-sm italic text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                      className="inline mr-2 align-middle"
                    >
                      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 .876-.252 1.02-.598l.088-.416c.066-.3.04-.431-.225-.492l-.451-.084.738-3.468c.194-.897-.105-1.319-.808-1.319z" />
                      <circle cx="8" cy="4.5" r="1" />
                    </svg>
                    <span className="inline align-middle">
                      Connect to a database to start defining your data schema
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Preview/Error Panel */}
            <div className="w-1/2 bg-gray-50 p-4 rounded-md border border-gray-300 h-[40vh] overflow-y-auto">
              <h2 className="text-md font-semibold">Data Preview & Errors</h2>
              {error ? (
                <div className="text-red-600 text-sm">Error: {error}</div>
              ) : sampleData ? (
                <div>{sampleData.map((data, index) => renderTable(data, index))}</div>
              ) : (
                <div className="text-gray-500 text-sm mt-2">
                  Click 'Preview Script' to see fake data from your template or view errors.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSchemaEditorPanel;
