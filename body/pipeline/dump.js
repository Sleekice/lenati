const fs=require('fs'); const src=fs.readFileSync(__dirname+'/data.js','utf8');
const f=new Function(src+';return {BODY,PASSAGES,TUNNEL_ENTRY,SYSTEMS,LAYERS,CARE};'); const o=f();
fs.writeFileSync(__dirname+'/curated.json',JSON.stringify(o));
