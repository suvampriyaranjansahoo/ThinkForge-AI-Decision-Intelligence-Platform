const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
test('Streamlit deployment adapter has required files',()=>{
 const root=path.join(__dirname,'..');
 assert.ok(fs.existsSync(path.join(root,'streamlit_app','app.py')));
 assert.ok(fs.existsSync(path.join(root,'streamlit_app','requirements.txt')));
});
test('node_modules is excluded from version control and deployment artifacts',()=>{
 const root=path.join(__dirname,'..');
 const gitignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
 assert.ok(/(^|\n)node_modules(\/|\n|$)/.test(gitignore),'node_modules must be listed in .gitignore so it is never committed or shipped');
});
