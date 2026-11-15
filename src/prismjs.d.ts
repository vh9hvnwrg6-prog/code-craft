declare module 'prismjs' {
  interface Prism {
    languages: { [key: string]: any };
    highlight(code: string, grammar: any, language: string): string;
  }
  const Prism: Prism;
  export default Prism;
}