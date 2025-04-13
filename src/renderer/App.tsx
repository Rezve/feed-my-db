import React from 'react';
import './styles/App.css';
import HomePage from './pages/HomePage';
import { NotificationProvider } from './components/notification/NotificationContext';
import StatusBar from './components/Statusbar';
import TitleBar from './components/TitleBar';

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Custom Title Bar */}
        <TitleBar />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <HomePage />
        </div>

        <StatusBar />
      </div>
    </NotificationProvider>
  );
};

export default App;
