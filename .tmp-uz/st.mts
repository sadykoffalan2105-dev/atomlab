import { analyzeTerms } from '../src/learn/kb/analyzer.ts'
for (const s of process.argv.slice(2)) console.log(s, '→', JSON.stringify(analyzeTerms(s)))
