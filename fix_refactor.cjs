const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const f of files) {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/const (\w+) = useSupabase\(''\)/g, 'const $1 = useSupabase(\'$1\')');
  
  fs.writeFileSync(filePath, content);
}
console.log('Fixed useSupabase arguments');
