// Nube simulada en memoria para las pruebas con navegador (28/11/2026).
// Contesta como Supabase: /auth/v1 (usuarios cesar y tienda) y /rest/v1 con los filtros que usa la app
// (eq, in, gte, lte, is, order, limit), insert/upsert (on_conflict), update y delete, y el rpc puente_edad.
// Uso: const nube=require('./nube-simulada'); const db=nube.nueva(); await nube.conectar(page,db);
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function sesion(email){
  const now=Math.floor(Date.now()/1000);
  const user={id:'u-'+email,aud:'authenticated',role:'authenticated',email,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const tok=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,email,role:'authenticated',aud:'authenticated',exp:now+3600,iat:now})+'.firma';
  return {access_token:tok,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r-'+email,user};
}
const USERS={'cesar@cobros.local':'clave-buena','tienda@cobros.local':'clave-tienda'};
const LLAVES={dias:'fecha',pendientes_entrega:'nro',puente:'id',alertas:'clave',respaldos:'id'};
function nueva(){return {tablas:{dias:[],pendientes_entrega:[],puente:[],alertas:[],respaldos:[],reportes_pedidos:[],kardex_proveedores:[],kardex_pedidos:[]},edad:5,log:[]};}
function valor(s){s=decodeURIComponent(s);if(/^".*"$/.test(s))s=s.slice(1,-1);return s;}
function cmp(a,b){if(a===null||a===undefined)return -1;const na=Number(a),nb=Number(b);if(!isNaN(na)&&!isNaN(nb)&&a!==''&&b!=='')return na-nb;return String(a)<String(b)?-1:String(a)>String(b)?1:0;}
function pasa(f,col,op,v){
  const x=f[col];
  if(op==='eq'){if(v==='true')return x===true;if(v==='false')return x===false;return String(x)===v;}
  if(op==='neq')return String(x)!==v;
  if(op==='in'){const l=v.replace(/^\(|\)$/g,'').split(',').map(valor);return l.includes(String(x));}
  if(op==='gte')return x!==null&&x!==undefined&&cmp(x,v)>=0;
  if(op==='lte')return x!==null&&x!==undefined&&cmp(x,v)<=0;
  if(op==='gt')return x!==null&&x!==undefined&&cmp(x,v)>0;
  if(op==='lt')return x!==null&&x!==undefined&&cmp(x,v)<0;
  if(op==='is')return v==='null'?(x===null||x===undefined):String(x)===v;
  return true;
}
function filtrar(filas,sp){
  let out=filas;
  for(const [k,raw] of sp){
    if(['select','order','limit','offset','on_conflict','columns'].includes(k))continue;
    const m=raw.match(/^(not\.)?([a-z]+)\.(.*)$/);if(!m)continue;
    const neg=!!m[1],op=m[2],v=m[3];
    out=out.filter(f=>neg?!pasa(f,k,op,valor(v)):pasa(f,k,op,op==='in'?v:valor(v)));
  }
  return out;
}
function elegir(f,sel){if(!sel||sel==='*')return JSON.parse(JSON.stringify(f));const o={};sel.split(',').forEach(c=>{c=c.trim();if(c)o[c]=f[c]===undefined?null:JSON.parse(JSON.stringify(f[c]));});return o;}
async function conectar(page,db,opc={}){
  const UMD=fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
  await page.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
  await page.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  if(opc.jspdf)await page.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(opc.jspdf,'utf8')}));
  await page.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
    const q=r.request(),u=new URL(q.url()),M=q.method();
    const json=(st,b,h)=>r.fulfill({status:st,contentType:'application/json',headers:h||{},body:b===undefined?'':JSON.stringify(b)});
    if(u.pathname.startsWith('/auth/v1/')){
      if(u.pathname==='/auth/v1/token'){const d=JSON.parse(q.postData()||'{}');
        if(u.searchParams.get('grant_type')==='password'&&USERS[d.email]===d.password)return json(200,sesion(d.email));
        return json(400,{code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'});}
      if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204,body:''});
      return json(200,{});
    }
    if(u.pathname==='/rest/v1/rpc/puente_edad')return json(200,db.edad);
    if(u.pathname.startsWith('/rest/v1/rpc/'))return json(200,null);
    const tabla=u.pathname.replace('/rest/v1/','');
    const T=db.tablas[tabla]||(db.tablas[tabla]=[]);
    const sp=[...u.searchParams.entries()];
    const sel=u.searchParams.get('select');
    const prefer=q.headers()['prefer']||'',accept=q.headers()['accept']||'';
    const uno=accept.includes('vnd.pgrst.object');
    db.log.push(M+' '+tabla+u.search);
    if(M==='GET'||M==='HEAD'){
      let out=filtrar(T,sp);
      const ord=u.searchParams.get('order');
      if(ord){const parts=ord.split(',').map(p=>p.split('.'));out=out.slice().sort((a,b)=>{for(const [c,dir] of parts){const d=cmp(a[c],b[c]);if(d)return dir==='desc'?-d:d;}return 0;});}
      const lim=u.searchParams.get('limit');if(lim)out=out.slice(0,+lim);
      out=out.map(f=>elegir(f,sel));
      if(uno){if(!out.length)return json(406,{code:'PGRST116',message:'JSON object requested, multiple (or no) rows returned',details:'The result contains 0 rows'});return json(200,out[0]);}
      return json(200,out);
    }
    if(M==='POST'){
      let filas=JSON.parse(q.postData()||'[]');if(!Array.isArray(filas))filas=[filas];
      const llave=u.searchParams.get('on_conflict')||LLAVES[tabla];
      const merge=/merge-duplicates/.test(prefer),ign=/ignore-duplicates/.test(prefer);
      const hechas=[];
      for(const f of filas){
        const ex=llave?T.find(x=>String(x[llave])===String(f[llave])):null;
        if(ex&&(merge||ign)){if(merge)Object.assign(ex,JSON.parse(JSON.stringify(f)));hechas.push(ex);continue;}
        if(ex)return json(409,{code:'23505',message:'duplicate key'});
        const n=JSON.parse(JSON.stringify(f));if(tabla==='respaldos'&&n.id===undefined)n.id=T.length+1;T.push(n);hechas.push(n);
      }
      if(/return=representation/.test(prefer)){const out=hechas.map(f=>elegir(f,sel));return json(201,uno?out[0]:out);}
      return r.fulfill({status:201,body:''});
    }
    if(M==='PATCH'){
      const cambios=JSON.parse(q.postData()||'{}');const tocadas=filtrar(T,sp);
      tocadas.forEach(f=>Object.assign(f,JSON.parse(JSON.stringify(cambios))));
      if(/return=representation/.test(prefer)){const out=tocadas.map(f=>elegir(f,sel));return json(200,uno?out[0]:out);}
      return r.fulfill({status:204,body:''});
    }
    if(M==='DELETE'){const quitar=new Set(filtrar(T,sp));db.tablas[tabla]=T.filter(f=>!quitar.has(f));return r.fulfill({status:204,body:''});}
    return json(200,[]);
  });
  await page.route(/^https:\/\/(?!shlolncjhfzqmcllwjrk|cdn\.jsdelivr|cdnjs\.cloudflare|fonts\.googleapis)[^/]+\//,r=>r.fulfill({status:200,body:''}));
}
async function entrar(page,usuario,clave){
  await page.fill('#loginUser',usuario||'cesar');await page.fill('#loginPin',clave||'clave-buena');
  await page.click('#loginForm button[type=submit]');await page.waitForTimeout(2500);
}
module.exports={nueva,conectar,entrar};
