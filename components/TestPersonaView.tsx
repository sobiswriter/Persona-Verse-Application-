
import React, { useState, useCallback } from 'react';
import { Persona, GroundingChunk, GroundingChunkWeb } from '../types';
import { testPersonaResponse } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface TestPersonaViewProps {
  persona: Persona;
  onBack: () => void;
}

const GroundingInfo: React.FC<{ chunks?: GroundingChunk[] }> = ({ chunks }) => {
  if (!chunks || chunks.length === 0) return null;

  const webChunks = chunks
    .filter(chunk => chunk.web && chunk.web.uri)
    .map(chunk => chunk.web) as GroundingChunkWeb[];

  if (webChunks.length === 0) return null;

  return (
    <div className="mt-5 p-4 bg-slate-100 rounded-lg border border-slate-200">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">Sources from Google Search:</h4>
      <ul className="list-disc list-inside space-y-1">
        {webChunks.map((chunk, index) => (
          <li key={index} className="text-xs text-slate-600">
            {chunk.uri ? (
              <a 
                href={chunk.uri} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-blue-600 underline decoration-blue-500/50 hover:decoration-blue-500"
                title={chunk.title || chunk.uri}
              >
                {chunk.title || chunk.uri}
              </a>
            ) : (
              <span>{chunk.title || 'Source link unavailable'}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};


const TestPersonaView: React.FC<TestPersonaViewProps> = ({ persona, onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[] | undefined>(undefined);

  const handleSubmitTest = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a test prompt.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setGroundingChunks(undefined);
    try {
      const result = await testPersonaResponse(persona, prompt);
      setResponse(result.text);
      if (result.groundingChunks) {
        setGroundingChunks(result.groundingChunks as GroundingChunk[]);
      }
    } catch (e: any) {
      let errorMessage = e.message || "Failed to get response.";
      if (e && e.error && (e.error.code === 429 || e.error.status === 'RESOURCE_EXHAUSTED')) {
          errorMessage = `API Quota Exceeded. Please check your Google Cloud plan and billing details. Cannot test at this time. (${e.error.message || ''})`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, persona]);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto bg-white rounded-lg shadow-xl my-8 border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-800 mb-3 sm:mb-0">
          Test Persona: {persona.name}
        </h2>
        <button
          onClick={onBack}
          className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          &larr; Back to Chat
        </button>
      </div>

      <div className="mb-5">
        <label htmlFor="testPrompt" className="block mb-1.5 text-sm font-medium text-slate-700">
          Enter your test scenario or question:
        </label>
        <textarea
          id="testPrompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`E.g., "What are your views on...?"`}
          rows={4}
          className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-3 placeholder-slate-400 resize-y custom-scrollbar transition-shadow duration-200"
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleSubmitTest}
        disabled={isLoading || !prompt.trim()}
        className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors duration-200 flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        {isLoading ? <LoadingSpinner size="sm" color="text-white"/> : `Get ${persona.name}'s Response`}
      </button>

      {error && <div className="mt-5"><ErrorMessage message={error} onClear={() => setError(null)} /></div>}

      {response && !isLoading && (
        <div className="mt-8 p-5 bg-slate-50 rounded-lg shadow-inner border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Persona's Response:</h3>
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">{response}</p>
          <GroundingInfo chunks={groundingChunks} />
        </div>
      )}
    </div>
  );
};

export default TestPersonaView;