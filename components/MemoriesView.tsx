
import React, { useState, useEffect, useCallback } from 'react';
import { Persona, Memory } from '../types';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner'; // If needed for async operations
import AppLogo from './AppLogo';

interface MemoriesViewProps {
  personas: Persona[];
  onSaveMemories: (personaId: string, memories: Memory[]) => void;
}

const IconWrapper: React.FC<{ iconName: string, isSolid?: boolean, className?: string }> = ({ iconName, isSolid, className = "" }) => (
    <svg className={`heroicon ${className || 'h-5 w-5'}`} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <use href={`https://unpkg.com/heroicons@2.1.3/24/${isSolid ? 'solid' : 'outline'}/${iconName}.svg#${iconName}`} />
    </svg>
);

const MemoryForm: React.FC<{
  memory?: Memory | null; // For editing
  personaId: string;
  onSubmit: (memory: Omit<Memory, 'id' | 'createdAt' | 'personaId'>, memoryIdToUpdate?: string) => void;
  onCancel: () => void;
}> = ({ memory, personaId, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(memory?.title || '');
  const [description, setDescription] = useState(memory?.description || '');
  const [date, setDate] = useState(memory?.date || '');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>(memory?.impact || 'medium');
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | 'neutral'>(memory?.sentiment || 'neutral');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('Title and Description are required.');
      return;
    }
    setFormError(null);
    onSubmit({ title, description, date, impact, sentiment }, memory?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-lg border border-slate-200 space-y-5">
      <h3 className="text-xl font-semibold text-slate-700 mb-4">{memory ? 'Edit Memory' : 'Add New Memory'}</h3>
      {formError && <ErrorMessage message={formError} onClear={() => setFormError(null)} />}
      <div>
        <label htmlFor="memTitle" className="block text-sm font-medium text-slate-600 mb-1">Title <span className="text-red-500">*</span></label>
        <input id="memTitle" type="text" value={title} onChange={e => setTitle(e.target.value)} required 
               className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 placeholder-slate-400"/>
      </div>
      <div>
        <label htmlFor="memDesc" className="block text-sm font-medium text-slate-600 mb-1">Description <span className="text-red-500">*</span></label>
        <textarea id="memDesc" value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                  className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 placeholder-slate-400 custom-scrollbar"/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="memDate" className="block text-sm font-medium text-slate-600 mb-1">Date (Optional)</label>
          <input id="memDate" type="date" value={date} onChange={e => setDate(e.target.value)}
                 className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label htmlFor="memImpact" className="block text-sm font-medium text-slate-600 mb-1">Impact</label>
          <select id="memImpact" value={impact} onChange={e => setImpact(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white text-slate-900">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label htmlFor="memSentiment" className="block text-sm font-medium text-slate-600 mb-1">Sentiment</label>
          <select id="memSentiment" value={sentiment} onChange={e => setSentiment(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white text-slate-900">
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-3">
        <button type="button" onClick={onCancel} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg shadow-sm">Cancel</button>
        <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm">{memory ? 'Save Changes' : 'Add Memory'}</button>
      </div>
    </form>
  );
};


const MemoriesView: React.FC<MemoriesViewProps> = ({ personas, onSaveMemories }) => {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  const selectedPersona = personas.find(p => p.id === selectedPersonaId);
  const memoriesForSelectedPersona = selectedPersona?.memories || [];

  useEffect(() => {
    // If a selected persona is removed from the main list (e.g., deleted), reset selection.
    if (selectedPersonaId && !personas.find(p => p.id === selectedPersonaId)) {
      setSelectedPersonaId(null);
      setShowForm(false);
      setEditingMemory(null);
    }
  }, [personas, selectedPersonaId]);

  const handleAddOrUpdateMemory = useCallback((memoryData: Omit<Memory, 'id' | 'createdAt' | 'personaId'>, memoryIdToUpdate?: string) => {
    if (!selectedPersonaId) {
      setViewError("No persona selected to save memory to.");
      return;
    }
    setViewError(null);

    let updatedMemories: Memory[];
    if (memoryIdToUpdate) { // Update existing
      updatedMemories = memoriesForSelectedPersona.map(mem =>
        mem.id === memoryIdToUpdate
          ? { ...mem, ...memoryData, personaId: selectedPersonaId } 
          : mem
      );
    } else { // Add new
      const newMemory: Memory = {
        ...memoryData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        personaId: selectedPersonaId,
      };
      updatedMemories = [...memoriesForSelectedPersona, newMemory];
    }
    onSaveMemories(selectedPersonaId, updatedMemories);
    setShowForm(false);
    setEditingMemory(null);
  }, [selectedPersonaId, memoriesForSelectedPersona, onSaveMemories]);

  const handleDeleteMemory = useCallback((memoryIdToDelete: string) => {
    if (!selectedPersonaId) return;
    if (window.confirm("Are you sure you want to delete this memory?")) {
      const updatedMemories = memoriesForSelectedPersona.filter(mem => mem.id !== memoryIdToDelete);
      onSaveMemories(selectedPersonaId, updatedMemories);
    }
  }, [selectedPersonaId, memoriesForSelectedPersona, onSaveMemories]);

  const getImpactColor = (impact: Memory['impact']) => {
    if (impact === 'high') return 'bg-red-100 text-red-700';
    if (impact === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  }

  const getSentimentColor = (sentiment: Memory['sentiment']) => {
    if (sentiment === 'positive') return 'bg-green-100 text-green-700';
    if (sentiment === 'negative') return 'bg-pink-100 text-pink-700';
    return 'bg-slate-100 text-slate-700';
  }

  if (personas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
        <IconWrapper iconName="users" className="w-16 h-16 text-slate-400 mb-6" />
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">No Personas Available</h2>
        <p className="text-slate-500 max-w-md">
          You need to create at least one persona before you can manage their memories.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <h1 className="text-xl font-semibold text-slate-800 flex items-center">
          <IconWrapper iconName="archive-box" isSolid className="mr-2 h-6 w-6 text-blue-500" />
          Manage Persona Memories
        </h1>
      </header>

      <div className="p-4 md:p-6 bg-slate-100 border-b border-slate-200 space-y-4">
        <div>
          <label htmlFor="personaSelect" className="block text-sm font-medium text-slate-700 mb-1.5">Select Persona:</label>
          <select
            id="personaSelect"
            value={selectedPersonaId || ""}
            onChange={(e) => {
              setSelectedPersonaId(e.target.value || null);
              setShowForm(false);
              setEditingMemory(null);
              setViewError(null);
            }}
            className="w-full md:w-1/2 lg:w-1/3 p-2.5 bg-white border border-slate-300 text-slate-800 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">-- Choose a Persona --</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {viewError && <ErrorMessage message={viewError} onClear={() => setViewError(null)} />}
        {selectedPersona && !showForm && (
          <button
            onClick={() => { setEditingMemory(null); setShowForm(true); }}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm flex items-center"
          >
            <IconWrapper iconName="plus-circle" isSolid className="mr-2" /> Add New Memory for {selectedPersona.name}
          </button>
        )}
      </div>

      <div className="flex-grow p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-50">
        {showForm && selectedPersonaId && (
          <div className="mb-8 max-w-2xl mx-auto">
            <MemoryForm
              memory={editingMemory}
              personaId={selectedPersonaId}
              onSubmit={handleAddOrUpdateMemory}
              onCancel={() => { setShowForm(false); setEditingMemory(null); }}
            />
          </div>
        )}

        {!selectedPersonaId && !showForm && (
          <div className="text-center text-slate-500 pt-10">
            <AppLogo className="w-16 h-16 text-blue-400/70 mx-auto mb-4" />
            <p>Select a persona from the dropdown above to view or manage their memories.</p>
          </div>
        )}

        {selectedPersonaId && !showForm && memoriesForSelectedPersona.length === 0 && (
          <div className="text-center text-slate-500 pt-10">
            <IconWrapper iconName="document-magnifying-glass" className="w-12 h-12 text-slate-400 mx-auto mb-3"/>
            <p>No memories recorded for {selectedPersona?.name} yet.</p>
            <p className="text-sm">Click "Add New Memory" to create one.</p>
          </div>
        )}

        {selectedPersonaId && !showForm && memoriesForSelectedPersona.length > 0 && (
          <div className="space-y-4">
            {memoriesForSelectedPersona.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(mem => (
              <div key={mem.id} className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">{mem.title}</h4>
                    {mem.date && <p className="text-xs text-slate-500 mb-1">Occurred: {new Date(mem.date).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <button 
                      onClick={() => { setEditingMemory(mem); setShowForm(true); }} 
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md w-8 h-8 flex items-center justify-center" 
                      title="Edit Memory"
                    >
                      <span className="font-bold text-lg leading-none">*</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteMemory(mem.id)} 
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md w-8 h-8 flex items-center justify-center" 
                      title="Delete Memory"
                    >
                      <span className="font-bold text-lg leading-none">^</span>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-2 whitespace-pre-wrap">{mem.description}</p>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${getImpactColor(mem.impact)}`}>Impact: {mem.impact}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${getSentimentColor(mem.sentiment)}`}>Sentiment: {mem.sentiment}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-right">Created: {new Date(mem.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoriesView;
