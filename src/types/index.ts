export interface Column {
  id?: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
  constraints: string[];
}

export interface Table {
  id?: string;
  name: string;
  columns: Column[];
  x?: number;
  y?: number;
}

export interface Schema {
  tables: Table[];
}

export interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export type Dialect = 'PostgreSQL' | 'MySQL' | 'SQLite';

export type ActiveTool = 'select' | 'addTable' | 'addConnection-1-n' | 'addConnection-n-n';

export interface Project {
  id: string;
  name: string;
  schema: Schema | null;
  messages: Message[];
  ddl: string;
  undoStack: (Schema | null)[];
  redoStack: (Schema | null)[];
  lastModified: number;
}


