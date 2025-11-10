import { GoogleGenAI, Type } from "@google/genai";
import { Schema, Dialect } from "@/types";

const schemaResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          columns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                isPrimaryKey: { type: Type.BOOLEAN },
                isForeignKey: { type: Type.BOOLEAN },
                foreignKeyTable: { type: Type.STRING },
                foreignKeyColumn: { type: Type.STRING },
                constraints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['name', 'type', 'isPrimaryKey', 'isForeignKey', 'constraints'],
            },
          },
        },
        required: ['name', 'columns'],
      },
    },
  },
  required: ['tables'],
};

const resolveApiKey = (provided?: string): string => {
  const key = (provided || '').trim();
  if (!key) {
    throw new Error("No API key available. Add your key in Settings.");
  }
  return key;
};

const getClient = (apiKey?: string) => {
  const key = resolveApiKey(apiKey);
  if (!key) {
    throw new Error("No API key available. Provide one in Settings or via environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const parseDdl = async (ddl: string, apiKey?: string): Promise<Schema> => {
  const ai = getClient(apiKey);
  const prompt = `
    Parse the following SQL DDL and convert it into a JSON object matching the provided schema.
    Identify table names, column names, data types, primary keys, foreign keys (with their referenced table and column), and other constraints like NOT NULL, UNIQUE, or CHECK.
    If a column is a foreign key, correctly identify the 'foreignKeyTable' and 'foreignKeyColumn' it references.

    DDL:
    ---
    ${ddl}
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schemaResponseSchema,
    },
  });

  const text = response.text.trim();
  try {
    return JSON.parse(text) as Schema;
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
};

export const createSchemaFromPrompt = async (request: string, apiKey?: string): Promise<Schema> => {
  const ai = getClient(apiKey);
  const prompt = `
    You are an expert database architect. A user wants to create a new database schema from scratch based on a description.
    Based on the user's request, create a JSON schema and return it as a JSON object.
    Make reasonable assumptions for data types, primary keys, and relationships. For example, a 'users' table should probably have an 'id' primary key.
    Do not respond with anything other than the JSON object.
    
    User Request:
    ---
    "${request}"
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schemaResponseSchema,
    },
  });
  
  const text = response.text.trim();
  try {
    return JSON.parse(text) as Schema;
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
};

export const modifySchema = async (request: string, currentSchema: Schema, apiKey?: string): Promise<Schema> => {
  const ai = getClient(apiKey);
  const prompt = `
    You are an expert database architect. A user wants to modify an existing database schema.
    Based on the user's request, update the provided JSON schema and return the **entire modified schema** as a JSON object.
    Do not respond with anything other than the JSON object.
    
    Current Schema:
    ---
    ${JSON.stringify(currentSchema, null, 2)}
    ---
    
    User Request:
    ---
    "${request}"
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schemaResponseSchema,
    },
  });
  
  const text = response.text.trim();
  try {
    return JSON.parse(text) as Schema;
  } catch {
    throw new Error("AI response was not valid JSON.");
  }
};

export const generateDdl = async (schema: Schema, dialect: Dialect, apiKey?: string): Promise<string> => {
  const ai = getClient(apiKey);
  const prompt = `
    Generate a SQL DDL script for the following database schema JSON.
    The target SQL dialect is ${dialect}.
    The script should be complete and executable, including CREATE TABLE statements, column definitions, PRIMARY KEY constraints, FOREIGN KEY constraints, and other constraints like NOT NULL and UNIQUE.
    
    Schema:
    ---
    ${JSON.stringify(schema, null, 2)}
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text.trim();
};

export const testApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = getClient(apiKey);
    await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'ping' });
    return true;
  } catch {
    return false;
  }
};

export const generateCustom = async (schema: Schema, target: string, apiKey?: string): Promise<string> => {
  const ai = getClient(apiKey);
  const prompt = `
    Generate the following target representation for the provided database schema JSON.
    Target description: "${target}"
    
    Requirements:
    - Produce only the generated content (no explanations or backticks).
    - Be idiomatic for the target (naming, imports, structure).
    - Include relationships and constraints when relevant.
    
    Schema:
    ---
    ${JSON.stringify(schema, null, 2)}
    ---
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
  });
  return response.text.trim();
};


