/**
 * Calculator Tool for pi-mono-mini
 * Simple math expression evaluator
 */

import type { Tool } from '../types.js';

export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Evaluate mathematical expressions like "2 + 2", "sqrt(16)", "10 * 5", etc.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate (e.g., "123 * 456")',
      },
    },
    required: ['expression'],
  },
  
  execute: async (args: { expression: string }): Promise<string> => {
    const { expression } = args;
    
    // Security: only allow safe math characters
    const safePattern = /^[\d\s\+\-\*\/\(\)\.\^\%\sqrt]+$/;
    if (!safePattern.test(expression)) {
      throw new Error('Invalid characters in expression. Only numbers and + - * / ( ) . ^ % sqrt allowed.');
    }

    try {
      // Replace ^ with ** for exponentiation
      let normalizedExpr = expression.replace(/\^/g, '**');
      
      // Replace sqrt with Math.sqrt
      normalizedExpr = normalizedExpr.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
      
      // Use Function constructor for safer eval (still not 100% safe, but ok for demo)
      const result = new Function('return ' + normalizedExpr)();
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      
      return String(result);
    } catch (error: any) {
      throw new Error(`Failed to evaluate "${expression}": ${error.message}`);
    }
  },
};

// Simple test
if (import.meta.url === `file://${process.argv[1]}`) {
  calculatorTool.execute({ expression: '123 * 456' })
    .then(result => console.log('Test result:', result))
    .catch(err => console.error('Test error:', err));
}
