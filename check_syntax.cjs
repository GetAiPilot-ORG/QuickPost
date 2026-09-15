const fs = require('fs');
const babel = require('@babel/parser');

try {
  const code = fs.readFileSync('client/src/pages/SocialInboxPage.jsx', 'utf-8');
  babel.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("Success! No syntax errors.");
} catch (e) {
  console.error("Syntax Error at line", e.loc?.line, "col", e.loc?.column);
  console.error(e.message);
}
