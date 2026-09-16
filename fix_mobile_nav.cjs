const fs = require('fs');

let code = fs.readFileSync('client/src/pages/SocialInboxPage.jsx', 'utf8');

// 1. Fix 100vh to 100dvh everywhere FIRST
code = code.replace(/100vh/g, '100dvh');

// Now the outer div has 100dvh
code = code.replace(
  /return\s*\(\s*<div\s*style=\{\{\s*display:\s*"flex",\s*flexDirection:\s*"column",\s*height:\s*"calc\(100dvh - 64px\)",/,
  'return (\n    <div\n      className={selectedItem ? "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:!h-[100dvh]" : ""}\n      style={{\n        display: "flex",\n        flexDirection: "column",\n        height: "calc(100dvh - 64px)",'
);

// We already successfully updated the Compact Page Header in the previous run, but let's just make sure.
// If it hasn't been updated yet:
code = code.replace(
  /\{\/\*\s*──\s*Compact Page Header\s*──\s*\*\/\}\s*<div\s*style=\{\{\s*background:\s*"#ffffff",\s*borderBottom:\s*"1px solid #d3cec6",/,
  '{/* ── Compact Page Header ── */}\n      <div\n        className={selectedItem ? "max-md:hidden" : ""}\n        style={{\n          background: "#ffffff",\n          borderBottom: "1px solid #d3cec6",'
);

fs.writeFileSync('client/src/pages/SocialInboxPage.jsx', code);
console.log("Done");
