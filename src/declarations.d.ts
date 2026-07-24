declare module '@strudel/core';
declare module '@strudel/mini';
declare module '@strudel/transpiler';

declare module '*.strudel' {
  const content: string;
  export default content;
}
