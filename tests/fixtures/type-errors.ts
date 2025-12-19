// This file has TypeScript type errors for testing

// Type mismatch
const num: number = 'string';

// Missing property
interface Person {
  name: string;
  age: number;
}

const person: Person = {
  name: 'John',
  // Missing 'age' property
};

export { num, person };
