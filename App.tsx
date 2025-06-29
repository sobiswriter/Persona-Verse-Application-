
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Persona, ChatMessage, AppView as MainContentViewType, Memory } from './types'; // Updated AppView import
import { LOCAL_STORAGE_KEY_PERSONAS, APP_TITLE, DEFAULT_PERSONA_IMAGE, MAX_CHAT_HISTORY_MESSAGES } from './constants';
import PersonaForm from './components/PersonaForm';
import PersonaListItem from './components/PersonaListItem';
import TestPersonaView from './components/TestPersonaView';
import ChatView from './components/ChatView';
import PlaygroundView from './components/PlaygroundView'; // Import PlaygroundView
import MemoriesView from './components/MemoriesView'; // Import MemoriesView
import ErrorMessage from './components/ErrorMessage';
import AppLogo from './components/AppLogo';

const IS_API_KEY_MISSING = (process.env.API_KEY || "MISSING_API_KEY") === "MISSING_API_KEY";

type ActiveSidebarItem = 'personas' | 'settings' | 'playground' | 'memories';

const App: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null); 
  const [mainContentView, setMainContentView] = useState<MainContentViewType>('welcome');
  const [activeSidebarItem, setActiveSidebarItem] = useState<ActiveSidebarItem>('personas');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isIconSidebarOpen, setIsIconSidebarOpen] = useState(false);

  useEffect(() => {
    if (IS_API_KEY_MISSING) {
      setApiKeyError("Configuration Error: The Gemini API Key is missing. Please ensure the API_KEY environment variable is correctly set. This application cannot function without it.");
    }
    try {
      const storedPersonas = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONAS);
      if (storedPersonas) {
        setPersonas(JSON.parse(storedPersonas));
      }
    } catch (e) {
      console.error("Failed to load personas from localStorage:", e);
      setError("Could not load saved personas. Your data might be corrupted.");
    }
  }, []);

  const savePersonas = useCallback((updatedPersonas: Persona[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PERSONAS, JSON.stringify(updatedPersonas));
      setPersonas(updatedPersonas);
    } catch (e) {
      console.error("Failed to save personas to localStorage:", e);
      setError("Could not save personas. Changes might not persist.");
    }
  }, []);

  const selectedPersonaForChatOrTest = useMemo(() => { 
    return personas.find(p => p.id === selectedPersonaId) || null;
  }, [personas, selectedPersonaId]);

  const handleCreatePersona = (personaData: Omit<Persona, 'id' | 'createdAt' | 'chatHistory' | 'memories'>) => {
    const newPersona: Persona = {
      ...personaData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      imageUrl: personaData.imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', personaData.name.toLowerCase().replace(/\s+/g, '') || `new${Date.now()}`),
      writingFileNames: personaData.writingFileNames || [],
      chatHistory: [],
      memories: [], // Initialize with empty memories
    };
    const updatedPersonas = [...personas, newPersona];
    savePersonas(updatedPersonas);
    setSelectedPersonaId(newPersona.id);
    setMainContentView('chat'); 
    setEditingPersona(null);
  };

  const handleUpdatePersona = (personaData: Omit<Persona, 'id' | 'createdAt' | 'chatHistory' | 'memories'>) => {
    if (!editingPersona) return;
    const updatedPersonas = personas.map(p =>
      p.id === editingPersona.id ? {
        ...editingPersona, // This will preserve existing memories, chatHistory
        ...personaData,
        imageUrl: personaData.imageUrl || editingPersona.imageUrl,
        writingFileNames: personaData.writingFileNames || editingPersona.writingFileNames || [],
      } : p
    );
    savePersonas(updatedPersonas);
    if (selectedPersonaId === editingPersona.id) {
        setMainContentView(mainContentView === 'form' ? 'chat' : mainContentView);
    } else if (mainContentView === 'form') { 
        setMainContentView('welcome');
    }
    setEditingPersona(null);
  };

  const handleDeletePersona = (personaId: string) => {
    if (window.confirm("Are you sure you want to delete this persona? This action cannot be undone.")) {
      const updatedPersonas = personas.filter(p => p.id !== personaId);
      savePersonas(updatedPersonas);
      if (selectedPersonaId === personaId) {
        setSelectedPersonaId(null);
        setMainContentView('welcome');
      }
    }
  };

  const handleUpdatePersonaChatHistory = useCallback((personaId: string, newMessages: ChatMessage[]) => {
    setPersonas(prevPersonas => {
      const updatedPersonas = prevPersonas.map(p => {
        if (p.id === personaId) {
          const trimmedHistory = newMessages.slice(-MAX_CHAT_HISTORY_MESSAGES);
          return { ...p, chatHistory: trimmedHistory };
        }
        return p;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY_PERSONAS, JSON.stringify(updatedPersonas));
      return updatedPersonas;
    });
  }, []);

  const handleSavePersonaMemories = useCallback((personaId: string, newMemories: Memory[]) => {
    setPersonas(prevPersonas => {
        const updatedPersonas = prevPersonas.map(p => {
            if (p.id === personaId) {
                return { ...p, memories: newMemories };
            }
            return p;
        });
        savePersonas(updatedPersonas); // Save all personas with the updated memories for one
        return updatedPersonas;
    });
  }, [savePersonas]);


  const handleSelectPersonaForChatOrTest = (personaId: string) => {
    setSelectedPersonaId(personaId);
    if (mainContentView !== 'chat' && mainContentView !== 'test') {
      setMainContentView('chat');
    }
  };
  
  const handleEditPersonaRequest = (persona: Persona) => {
    setEditingPersona(persona);
    setMainContentView('form');
  };

  const handleNewPersonaRequest = () => {
    setEditingPersona(null);
    setMainContentView('form');
  }

  const filteredPersonas = useMemo(() => {
    return personas.filter(persona => 
      persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      persona.biography.toLowerCase().includes(searchTerm.toLowerCase()) ||
      persona.characterDescription.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [personas, searchTerm]);
  
  const toggleIconSidebar = () => {
    setIsIconSidebarOpen(prev => !prev);
  };

  const IconWrapper: React.FC<{ iconName: string, isSolid?: boolean, className?: string }> = ({ iconName, isSolid, className ="" }) => (
    <svg className={`heroicon ${className || 'h-6 w-6'}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
    </svg>
  );

  const renderApiKeyError = () => (
    <div className="flex items-center justify-center h-screen bg-slate-100 p-4">
        <div className="bg-white border border-red-300 p-8 rounded-lg shadow-xl text-center max-w-lg">
            <h1 className="text-3xl font-bold mb-4 text-red-600">{APP_TITLE}</h1>
            <h2 className="text-xl font-semibold text-red-700 mb-3">Critical Application Error</h2>
            <ErrorMessage message={apiKeyError || "An unknown API key error occurred."} />
            <p className="text-slate-600 mt-4 text-sm">
                Please refer to the setup instructions to configure the API Key.
                The application requires a valid Gemini API Key to interact with the AI models.
            </p>
        </div>
    </div>
  );

  if (apiKeyError) {
    return renderApiKeyError();
  }

  const renderMainContent = () => {
    if (mainContentView === 'form') { 
      return <PersonaForm 
                onSubmit={editingPersona ? handleUpdatePersona : handleCreatePersona} 
                onCancel={() => { 
                    setEditingPersona(null); 
                    setMainContentView(selectedPersonaId ? 'chat' : 'welcome');
                }} 
                initialData={editingPersona} 
              />;
    }
    
    if (mainContentView === 'playground') {
        return <PlaygroundView personas={personas} />;
    }

    if (mainContentView === 'memories') {
        return <MemoriesView 
                  personas={personas} 
                  onSaveMemories={handleSavePersonaMemories} 
               />;
    }

    if (!selectedPersonaForChatOrTest && (mainContentView === 'chat' || mainContentView === 'test')) {
        setTimeout(() => setMainContentView('welcome'), 0); 
        return ( 
            <div className="flex flex-col items-center justify-center h-full text-center p-10">
                <AppLogo className="w-16 h-16 text-blue-500 mb-4 animate-pulse" />
                <p className="text-slate-500">Redirecting to welcome...</p>
            </div>
        );
    }
    
    switch (mainContentView) {
      case 'chat':
        if (!selectedPersonaForChatOrTest) return null; 
        return <ChatView 
                  persona={selectedPersonaForChatOrTest} 
                  onBack={() => {setSelectedPersonaId(null); setMainContentView('welcome')}} 
                  initialChatHistory={selectedPersonaForChatOrTest.chatHistory || []}
                  onSaveChatHistory={(messages) => handleUpdatePersonaChatHistory(selectedPersonaForChatOrTest.id, messages)}
                />;
      case 'test':
        if (!selectedPersonaForChatOrTest) return null; 
        return <TestPersonaView 
                  persona={selectedPersonaForChatOrTest} 
                  onBack={() => setMainContentView('chat')} 
                />;
      case 'welcome':
      default: 
        return ( 
          <div className="flex flex-col items-center justify-center h-full text-center p-10">
            <AppLogo className="w-24 h-24 text-blue-500 mb-6" />
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">Welcome to {APP_TITLE}</h2>
            <p className="text-slate-500">Select a persona, manage memories, use the Playground, or create a new persona.</p>
          </div>
        );
    }
  };
  
  // Determine if persona list sidebar should be shown
  const showPersonaListSidebar = activeSidebarItem !== 'memories' && 
                                 (activeSidebarItem === 'personas' || (window.innerWidth >= 640 && !isIconSidebarOpen));


  return (
    <div className="h-screen bg-slate-100 overflow-hidden">
      <nav 
        className={`fixed top-0 left-0 h-full w-20 bg-slate-800 p-4 flex flex-col items-center space-y-6 shadow-xl z-30 transition-transform duration-300 ease-in-out transform ${isIconSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
        aria-hidden={!isIconSidebarOpen && window.innerWidth < 640} 
      >
        <AppLogo className="h-8 w-8 text-blue-500 group-hover:text-blue-400 transition-colors mt-2 mb-2" />
        
        <button 
          onClick={() => { 
            setActiveSidebarItem('personas'); 
            if (mainContentView === 'playground' || mainContentView === 'memories' || mainContentView === 'settings') {
                 setMainContentView('welcome');
            } else if (mainContentView === 'form' && !selectedPersonaId) {
                 setMainContentView('welcome');
            } else if (mainContentView === 'form' && selectedPersonaId) {
                 setMainContentView('chat'); 
            }
            else if (!selectedPersonaId && mainContentView !== 'welcome' && mainContentView !== 'form') {
                 setMainContentView('welcome');
            }
            setIsIconSidebarOpen(false); 
          }}
          className={`p-3 rounded-xl hover:bg-slate-700 transition-colors duration-200 group w-full flex justify-center items-center ${activeSidebarItem === 'personas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          title="Personas"
        >
          <span className={`text-xl font-medium ${activeSidebarItem === 'personas' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>^_^</span>
        </button>

        <button
          onClick={() => {
            setActiveSidebarItem('playground');
            setMainContentView('playground');
            setIsIconSidebarOpen(false);
          }}
          className={`p-3 rounded-xl hover:bg-slate-700 transition-colors duration-200 group w-full flex justify-center items-center ${activeSidebarItem === 'playground' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          title="Playground"
        >
          <span className={`text-xl font-medium ${activeSidebarItem === 'playground' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>*_*</span>
        </button>

        <button 
          onClick={() => {
            setActiveSidebarItem('memories');
            setMainContentView('memories'); 
            setIsIconSidebarOpen(false); 
          }}
          className={`p-3 rounded-xl hover:bg-slate-700 transition-colors duration-200 group w-full flex justify-center items-center ${activeSidebarItem === 'memories' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          title="Memories"
        >
          <span className={`text-xl font-medium ${activeSidebarItem === 'memories' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{'>_<'}</span>
        </button>
      </nav>

      <div className={`flex h-full transition-all duration-300 ease-in-out ${isIconSidebarOpen && window.innerWidth < 640 ? 'ml-20' : 'sm:ml-20'}`}>
        {/* Persona List Pane */}
        <aside 
          className={`w-80 bg-white border-r border-slate-200 flex-col shadow-md z-10 
                      transition-all duration-300 ease-in-out
                      ${showPersonaListSidebar ? 'flex' : 'hidden -ml-80'}`}
        >
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-700 mb-1">{APP_TITLE}</h2>
            <p className="text-xs text-slate-500">Your Persona Universe</p>
          </div>
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              placeholder="Search personas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm"
            />
          </div>
          <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredPersonas.length > 0 ? (
              filteredPersonas.map(persona => (
                <PersonaListItem
                  key={persona.id}
                  persona={persona}
                  isSelected={selectedPersonaId === persona.id && mainContentView !== 'playground' && mainContentView !== 'memories'}
                  onSelect={() => handleSelectPersonaForChatOrTest(persona.id)}
                  onChat={() => { setSelectedPersonaId(persona.id); setMainContentView('chat'); setActiveSidebarItem('personas');}}
                  onTest={() => { setSelectedPersonaId(persona.id); setMainContentView('test'); setActiveSidebarItem('personas');}}
                  onEdit={() => handleEditPersonaRequest(persona)}
                  onDelete={() => handleDeletePersona(persona.id)}
                />
              ))
            ) : (
              <div className="text-center py-10 px-4">
                  <IconWrapper iconName="magnifying-glass" className="text-slate-400 mx-auto h-6 w-6" /> 
                  <p className="mt-2 text-sm text-slate-500">
                    {personas.length === 0 ? "No personas yet." : "No personas match search."}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {personas.length === 0 ? "Create one to get started!" : (searchTerm ? "Try a different search term." : "")}
                  </p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-200 flex items-center space-x-3">
            <button
              onClick={handleNewPersonaRequest}
              className="flex-grow flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              <IconWrapper iconName="plus-circle" isSolid className="h-5 w-5" />
              <span className="ml-2 text-sm">Create New Persona</span>
            </button>
            <button
              onClick={toggleIconSidebar}
              className="flex-shrink-0 p-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors shadow-sm flex items-center justify-center sm:hidden" 
              title={isIconSidebarOpen ? "Close Menu" : "Open Menu"}
              aria-label={isIconSidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={isIconSidebarOpen}
              style={{ width: '44px', height: '44px' }}
            >
              <IconWrapper iconName={isIconSidebarOpen ? "x-mark" : "bars-3"} className="h-6 w-6" />
            </button>
          </div>
        </aside>

        <main className="flex-grow bg-slate-50 overflow-y-auto custom-scrollbar">
          {error && <div className="m-4"><ErrorMessage message={error} onClear={() => setError(null)} /></div>}
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
