import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ProfileSetup } from './components/ProfileSetup';
import { Dashboard } from './components/Dashboard';
import { ChatInterface } from './components/ChatInterface';
import { ServerSetup } from './components/ServerSetup';
import { AppView } from './types';

const MainContent: React.FC = () => {
  const { currentUser, isConfigured } = useApp();
  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  if (!isConfigured) {
    return <ServerSetup />;
  }

  if (!currentUser) {
    return <ProfileSetup />;
  }

  // Simple Router
  if (currentView === 'chat') {
    return <ChatInterface onBack={() => setCurrentView('dashboard')} />;
  }

  return <Dashboard onViewChange={setCurrentView} />;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        <MainContent />
      </div>
    </AppProvider>
  );
};

export default App;