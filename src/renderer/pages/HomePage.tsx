import React, { useState } from 'react';
import DataSchemaEditorPanel from '../components/DataSchemaEditorPanel';
import DataInsertionPanel from '../components/DataInsertionPanel';
import DBConfig from '../components/DBConfig';
import LiveLog from '../components/LiveLog';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import TableColumnSelectorModal from '../components/TableColumnSelectorModal';
import { BasicCode } from '../utils/sample-code';

const HomePage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableNames, setTableNames] = useState<string[]>();
  const [isConnected, setIsConnected] = useState(false);
  const [isCodeConfirmed, setCodeConfirmed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [code, setCode] = useState<string>(BasicCode);
  const handleSaveCode = (tableNames: string[], generatedCode: string) => {
    setTableNames(tableNames);
    setCode(generatedCode);
    // setCodeConfirmed(true);
    window.electronAPI.send('app:code', generatedCode);
  };

  const handleOpenModal = (flag: boolean) => {
    setIsModalOpen(flag);
  };

  return (
    <div className="flex h-full">
      <PanelGroup direction="horizontal" autoSaveId="FeedMyDB-Sidebar">
        {/* Left Sidebar */}
        <Panel defaultSize={18} collapsedSize={5} minSize={5}>
          <div className="w-80 flex flex-col bg-gray-100 p-4 space-y-4 overflow-y-auto">
            <DBConfig isConnected={isConnected} setIsConnected={setIsConnected} />
            <DataInsertionPanel
              isConnected={isConnected}
              isRunning={isRunning}
              isCodeConfirmed={isCodeConfirmed}
              setIsRunning={setIsRunning}
              tableNames={tableNames}
              setIsModalOpen={setIsModalOpen}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="border hover:border-blue-500 hover:bg-blue-100 transition" />

        <Panel>
          <PanelGroup autoSaveId="FeedMyDB-Editor" direction="vertical">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              <Panel>
                <div className="flex-1 p-4">
                  <DataSchemaEditorPanel
                    isConnected={isConnected}
                    isCodeConfirmed={isCodeConfirmed}
                    setCodeConfirmed={setCodeConfirmed}
                    openTableConfigModal={handleOpenModal}
                    code={code}
                    setCode={setCode}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="border hover:border-blue-500 hover:bg-blue-100 transition" />
              {/* Bottom Docked Logs */}
              <Panel minSize={5}>
                <div className="h-1/3 bg-gray-100 p-4">
                  <LiveLog />
                </div>
              </Panel>
            </div>
          </PanelGroup>
        </Panel>
      </PanelGroup>
      <TableColumnSelectorModal
        isConnected={isConnected}
        onSave={handleSaveCode}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      />
    </div>
  );
};

export default HomePage;
