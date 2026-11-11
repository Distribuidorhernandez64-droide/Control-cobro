// Prueba del inicio de sesión con Supabase Auth (sin PIN en el código).
// Nube simulada: /auth/v1 (usuarios cesar y tienda) y /rest/v1 (responde vacío).
const {chromium}=require('playwright-core');
const http=require('http'),fs=require('fs');
const APP=process.argv[2]||require('path').join(__dirname,'..','control-cobro-app.html');
const HTML=fs.readFileSync(APP,'utf8');
const UMD=fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
const ANON=(HTML.match(/const SB_KEY='([^']+)'/)||[])[1];
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8897);

const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
function sesion(email){
  const now=Math.floor(Date.now()/1000);
  const user={id:'u-'+email,aud:'authenticated',role:'authenticated',email,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const tok=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,email,role:'authenticated',aud:'authenticated',exp:now+3600,iat:now})+'.firma';
  return {access_token:tok,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r-'+email,user};
}
const USERS={'cesar@cobros.local':'clave-buena','tienda@cobros.local':'clave-tienda'};

(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
  const ctx=await b.newContext();
  const p=await ctx.newPage();
  const errs=[],rest=[],auth=[];let tokenActual=null;
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.route(/^https:\/\/(?!shlolncjhfzqmcllwjrk)[^/]+\//,r=>r.fulfill({status:200,body:''}));
  await p.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
  await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await p.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
    const q=r.request(),u=new URL(q.url());
    if(u.pathname.startsWith('/auth/v1/')){
      auth.push(q.method()+' '+u.pathname+u.search);
      if(u.pathname==='/auth/v1/token'){
        const d=JSON.parse(q.postData()||'{}');
        if(u.searchParams.get('grant_type')==='password'&&USERS[d.email]&&USERS[d.email]===d.password){
          const s=sesion(d.email);tokenActual=s.access_token;
          return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(s)});}
        return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'})});
      }
      if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204,body:''});
      return r.fulfill({status:200,contentType:'application/json',body:'{}'});
    }
    rest.push({m:q.method(),path:u.pathname,auth:q.headers()['authorization']||''});
    if(u.pathname.startsWith('/rest/v1/rpc/'))return r.fulfill({status:200,contentType:'application/json',body:'5'});
    return r.fulfill({status:q.method()==='GET'?200:201,contentType:'application/json',body:'[]'});
  });

  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  await p.goto('http://localhost:8897/',{waitUntil:'load'});await p.waitForTimeout(1500);
  ok('Sin sesión: aparece la pantalla de entrar', await p.isVisible('#loginScreen'));
  ok('Sin sesión: no se pide nada a la base de datos ('+rest.length+')', rest.length===0);

  await p.fill('#loginUser','pedro');await p.fill('#loginPin','x');await p.click('#loginScreen button');await p.waitForTimeout(300);
  ok('Usuario que no existe: "Usuario incorrecto" sin preguntar a Supabase', (await p.textContent('#loginErr'))==='Usuario incorrecto'&&auth.length===0);

  await p.fill('#loginUser','cesar');await p.fill('#loginPin','mala');await p.click('#loginScreen button');await p.waitForTimeout(800);
  ok('Contraseña mala: "Contraseña incorrecta" y sigue afuera', (await p.textContent('#loginErr'))==='Contraseña incorrecta'&&await p.isVisible('#loginScreen'));
  ok('Contraseña mala: no se lee la base', rest.length===0);

  await p.fill('#loginUser','Cesar ');await p.fill('#loginPin','clave-buena');await p.click('#loginScreen button');await p.waitForTimeout(2500);
  ok('Contraseña buena: entra', await p.isHidden('#loginScreen'));
  ok('Entra como maestro', (await p.textContent('#quienSoy'))==='César (maestro)');
  ok('Después de entrar sí lee la base ('+rest.length+' pedidos)', rest.length>0);
  ok('Todo lo que pide a la base va con la sesión del usuario, no con la clave pública', rest.length>0&&rest.every(x=>x.auth==='Bearer '+tokenActual)&&!rest.some(x=>x.auth==='Bearer '+ANON));
  ok('Botones de maestro visibles', await p.evaluate(()=>esMaestro()));

  const antes=rest.length;
  await p.reload({waitUntil:'load'});await p.waitForTimeout(2000);
  ok('Al volver a abrir no pide contraseña otra vez', await p.isHidden('#loginScreen')&&(await p.textContent('#quienSoy'))==='César (maestro)');
  ok('Al volver a abrir lee la base con la sesión', rest.length>antes&&rest.slice(antes).every(x=>x.auth==='Bearer '+tokenActual));

  await p.click('#btnSalir');await p.waitForTimeout(2000);
  ok('Salir: vuelve a pedir contraseña', await p.isVisible('#loginScreen'));
  ok('Salir: avisa a Supabase (logout)', auth.some(x=>x.startsWith('POST /auth/v1/logout')));
  const quedo=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('auth-token')).length);
  ok('Salir: no queda sesión guardada en el teléfono', quedo===0);

  const n0=rest.length;await p.waitForTimeout(500);
  ok('Afuera no se lee la base', rest.length===n0);

  await p.fill('#loginUser','tienda');await p.fill('#loginPin','clave-tienda');await p.click('#loginScreen button');await p.waitForTimeout(2000);
  ok('Tienda entra como anotador', (await p.textContent('#quienSoy'))==='Tienda (anotador)'&&!(await p.evaluate(()=>esMaestro())));

  ok('El código ya no trae contraseñas ni PIN', !/pass:'/.test(HTML)&&!/const USUARIOS/.test(HTML));
  ok('Sin errores de la página'+(errs.length?': '+errs.join(' | '):''), errs.length===0);
  await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
