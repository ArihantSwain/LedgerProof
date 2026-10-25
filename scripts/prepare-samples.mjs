import {cp,mkdir} from 'node:fs/promises';
await mkdir('public/SAMPLES',{recursive:true});
await cp('SAMPLES','public/SAMPLES',{recursive:true});
