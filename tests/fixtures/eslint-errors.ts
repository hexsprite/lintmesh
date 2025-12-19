// This file has ESLint errors for testing

// Unused variable - should trigger no-unused-vars
const unusedVar = 42;

// @ts-expect-error - testing purposes
function badFunction(unusedParam) {
  // Missing return statement
  console.log('hello');
}

export { badFunction };
