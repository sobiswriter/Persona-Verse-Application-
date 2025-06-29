
import React, { useState, useEffect } from 'react';
import { Persona } from '../types';
import { DEFAULT_PERSONA_IMAGE } from '../constants';
import LoadingSpinner from './LoadingSpinner'; 
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';

if (typeof window !== 'undefined' && (window as any).pdfjsWorkerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = (window as any).pdfjsWorkerSrc;
}

interface PersonaFormProps {
  onSubmit: (personaData: Omit<Persona, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
  initialData?: Persona | null;
}

const InputField: React.FC<{ label: string; id: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string; required?: boolean }> = 
  ({ label, id, value, onChange, placeholder, type = "text", required = false }) => (
  <div className="mb-5">
    <label htmlFor={id} className="block mb-1.5 text-sm font-medium text-slate-700">{label}{required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-3 placeholder-slate-400 transition-shadow duration-200"
    />
  </div>
);

const TextAreaField: React.FC<{ label: string; id: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; rows?: number }> = 
  ({ label, id, value, onChange, placeholder, rows = 4 }) => (
  <div className="mb-5">
    <label htmlFor={id} className="block mb-1.5 text-sm font-medium text-slate-700">{label}</label>
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="bg-white border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full p-3 placeholder-slate-400 resize-y custom-scrollbar transition-shadow duration-200"
    />
  </div>
);

const PersonaForm: React.FC<PersonaFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [name, setName] = useState('');
  const [biography, setBiography] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');
  const [voiceSampleTranscript, setVoiceSampleTranscript] = useState('');
  const [writingsText, setWritingsText] = useState('');
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [fileInputKey, setFileInputKey] = useState<number>(Date.now());

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setBiography(initialData.biography);
      setCharacterDescription(initialData.characterDescription);
      setVoiceSampleTranscript(initialData.voiceSampleTranscript);
      setWritingsText(initialData.writings || '');
      setUploadedFileNames(initialData.writingFileNames || []);
      setImageUrl(initialData.imageUrl || '');
    } else {
      // Reset form for new persona
      setName('');
      setBiography('');
      setCharacterDescription('');
      setVoiceSampleTranscript('');
      setWritingsText('');
      setUploadedFileNames([]);
      setImageUrl('');
    }
  }, [initialData]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    // Keep existing text if user is adding more files, unless it's the first upload after a clear.
    // However, the current behavior is to clear on new selection, let's stick to that for now unless requested otherwise.
    setWritingsText(''); 
    setUploadedFileNames([]);

    let combinedText = '';
    const newFileNames: string[] = [];
    const processingPromises: Promise<void>[] = [];

    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        newFileNames.push(file.name);
        processingPromises.push(
          (async () => {
            try {
              const arrayBuffer = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                combinedText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n\n';
              }
            } catch (error) {
              console.error(`Error processing PDF ${file.name}:`, error);
              alert(`Failed to process PDF "${file.name}". It might be corrupted or unsupported.`);
            }
          })()
        );
      } else if (file.type === 'text/plain') {
        newFileNames.push(file.name);
        processingPromises.push(
          new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              combinedText += (e.target?.result as string) + '\n\n';
              resolve();
            };
            reader.onerror = (e) => {
              console.error(`Error reading TXT file ${file.name}:`, e);
              alert(`Failed to read TXT file "${file.name}".`);
              reject(e);
            };
            reader.readAsText(file);
          })
        );
      } else {
        alert(`File "${file.name}" is not a PDF or TXT file and will be ignored.`);
      }
    }
    
    await Promise.all(processingPromises);

    setWritingsText(combinedText.trim());
    setUploadedFileNames(newFileNames);
    setIsProcessingFiles(false);
  };
  
  const handleClearWritings = () => {
    setWritingsText('');
    setUploadedFileNames([]);
    setFileInputKey(Date.now()); // Reset file input by changing its key
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Persona name is required.");
      return;
    }
    onSubmit({
      name,
      biography,
      characterDescription,
      voiceSampleTranscript,
      writings: writingsText,
      writingFileNames: uploadedFileNames,
      imageUrl: imageUrl || DEFAULT_PERSONA_IMAGE.replace('defaultpersona', name.toLowerCase().replace(/\s+/g, '') || 'random'),
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto bg-white rounded-lg shadow-xl my-8 border border-slate-200">
      <h2 className="text-2xl font-semibold text-slate-800 mb-8 text-center">
        {initialData ? 'Edit Persona' : 'Create New Persona'}
      </h2>
      
      <form onSubmit={handleSubmit}>
        <InputField 
          label="Persona Name" 
          id="name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="E.g., Sherlock Holmes" 
          required={true}
        />
        <InputField 
          label="Image URL (Optional)" 
          id="imageUrl" 
          value={imageUrl} 
          onChange={(e) => setImageUrl(e.target.value)} 
          placeholder={`Leave blank for default, or provide URL`}
        />
        <TextAreaField 
          label="Biography" 
          id="biography" 
          value={biography} 
          onChange={(e) => setBiography(e.target.value)} 
          placeholder="Key life events, background..."
          rows={5}
        />
        <TextAreaField 
          label="Character Description" 
          id="characterDescription" 
          value={characterDescription} 
          onChange={(e) => setCharacterDescription(e.target.value)} 
          placeholder="Personality traits, quirks, motivations..."
          rows={5}
        />
        <TextAreaField 
          label="Voice Sample / Thought Patterns" 
          id="voiceSampleTranscript" 
          value={voiceSampleTranscript} 
          onChange={(e) => setVoiceSampleTranscript(e.target.value)} 
          placeholder="Distinct phrases, accent, vocabulary..."
          rows={3}
        />

        <div className="mb-6">
          <label htmlFor="writingsFiles" className="block mb-1.5 text-sm font-medium text-slate-700">
            Writings (Upload PDFs or TXT files)
          </label>
          <input
            type="file"
            id="writingsFiles"
            key={fileInputKey} // Used to reset the file input
            accept=".pdf,.txt" // Updated to accept .pdf and .txt
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-describedby="writings-help"
          />
          <p className="mt-1 text-xs text-slate-500" id="writings-help">
            Upload PDF or TXT documents. Text will be extracted.
          </p>
          {isProcessingFiles && (
            <div className="mt-2 flex items-center text-blue-600">
              <LoadingSpinner size="sm" color="text-blue-500" />
              <span className="ml-2 text-sm">Processing file(s)...</span>
            </div>
          )}
          {uploadedFileNames.length > 0 && !isProcessingFiles && (
            <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
              <h4 className="text-xs font-semibold text-slate-600 mb-1">Uploaded:</h4>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                {uploadedFileNames.map(fileName => (
                  <li key={fileName} className="text-xs text-slate-500 truncate" title={fileName}>{fileName}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleClearWritings}
                className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                Clear Uploads
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isProcessingFiles}
          >
            {initialData ? 'Save Changes' : 'Create Persona'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonaForm;
