declare global {
  interface Window {
    axel?: {
      saveFile?: (options: { data: ArrayBuffer; defaultPath: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
    };
  }
}

export {};
