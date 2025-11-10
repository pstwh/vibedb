import React from 'react';
import { ActiveTool } from '@/types';

interface ToolboxProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  disabled: boolean;
}

const tools = [
  { 
    name: 'select', 
    label: 'Select & Pan', 
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 8.188a3 3 0 100 4.243 3 3 0 000-4.243z" /></svg> 
  },
  { 
    name: 'addTable', 
    label: 'Add Table', 
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
  },
  { 
    name: 'addConnection-1-n', 
    label: 'Add 1-to-N Connection', 
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><line x1="5" y1="9" x2="5" y2="15"></line><line x1="19" y1="12" x2="15" y2="8"></line><line x1="19" y1="12" x2="15" y2="16"></line></svg>
  },
   { 
    name: 'addConnection-n-n', 
    label: 'Add N-to-N Connection', 
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><line x1="5" y1="12" x2="9" y2="8"></line><line x1="5" y1="12" x2="9" y2="16"></line><line x1="19" y1="12" x2="15" y2="8"></line><line x1="19" y1="12" x2="15" y2="16"></line></svg>
  },
];

const Toolbox: React.FC<ToolboxProps> = ({ activeTool, setActiveTool, disabled }) => {
  return (
    <div className="absolute top-1/2 left-4 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
      <div className="bg-gray-700/80 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-gray-600 flex flex-col gap-2 pointer-events-auto">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setActiveTool(tool.name as ActiveTool)}
            disabled={disabled}
            className={`p-2 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
              activeTool === tool.name
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            aria-label={tool.label}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Toolbox;


