// Prueba de "Entrar con Face ID / huella" (llaves de acceso de Supabase, beta) con respaldo de contraseña.
// Usa un autenticador virtual de Chrome (como el Face ID del teléfono) y una nube simulada.
const {chromium}=require('playwright-core');
const http=require('http'),fs=require('fs'),crypto=require('crypto');
const APP=process.argv[2]||require('path').join(__dirname,'..','control-cobro-app.html');
const HTML=fs.readFileSync(APP,'utf8');
const UMD=fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js'),'utf8');
const ANON=(HTML.match(/const SB_KEY='([^']+)'/)||[])[1];
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8895);

const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const rnd=n=>crypto.randomBytes(n).toString('base64url');
let N=0;
function sesion(email){
  const now=Math.floor(Date.now()/1000);
  const user={id:'u-'+email,aud:'authenticated',role:'authenticated',email,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const tok=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,email,role:'authenticated',aud:'authenticated',exp:now+3600,iat:now,n:++N})+'.firma';
  return {access_token:tok,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r-'+email+N,user};
}
const USERS={'cesar@cobros.local':'clave-buena','tienda@cobros.local':'clave-tienda'};
const TOKENS={};            // access_token -> email
const PASSKEYS={};          // credential id -> email
const RETOS={};             // challenge_id -> {tipo, email}
const ST={pkApagado:false};

(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
  const ctx=await b.newContext();
  const errs=[],rest=[],auth=[];
  async function nuevaPagina(){
    const p=await ctx.newPage();
    p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
    const cdp=await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    // El "Face ID" del teléfono: cada pestaña tiene su autenticador virtual, con las mismas llaves guardadas
    const r=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
    for(const c of (ctx._llaves||[]))await cdp.send('WebAuthn.addCredential',{authenticatorId:r.authenticatorId,credential:c});
    p._guardar=async()=>{ctx._llaves=(await cdp.send('WebAuthn.getCredentials',{authenticatorId:r.authenticatorId})).credentials;};
    await p.route(/^https:\/\/(?!shlolncjhfzqmcllwjrk)[^/]+\//,r=>r.fulfill({status:200,body:''}));
    await p.route('**/cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:UMD}));
    await p.route('https://shlolncjhfzqmcllwjrk.supabase.co/**',async r=>{
      const q=r.request(),u=new URL(q.url()),J=(c,o)=>r.fulfill({status:c,contentType:'application/json',body:JSON.stringify(o)});
      const quien=TOKENS[(q.headers()['authorization']||'').replace('Bearer ','')];
      if(u.pathname.startsWith('/auth/v1/')){
        auth.push(q.method()+' '+u.pathname);
        const d=JSON.parse(q.postData()||'{}');
        if(u.pathname==='/auth/v1/token'&&USERS[d.email]&&USERS[d.email]===d.password){const s=sesion(d.email);TOKENS[s.access_token]=d.email;return J(200,s);}
        if(u.pathname==='/auth/v1/token')return J(400,{code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'});
        if(u.pathname==='/auth/v1/logout')return r.fulfill({status:204,body:''});
        if(u.pathname.startsWith('/auth/v1/passkeys')&&ST.pkApagado)return J(404,{code:404,error_code:'passkey_disabled',msg:'Passkeys are disabled'});
        if(u.pathname==='/auth/v1/passkeys/registration/options'){
          if(!quien)return J(401,{msg:'no session'});
          const id=rnd(12);RETOS[id]={tipo:'reg',email:quien};
          return J(200,{challenge_id:id,options:{rp:{id:'localhost',name:'Control de Cobro'},user:{id:Buffer.from(quien).toString('base64url'),name:quien,displayName:quien},
            challenge:rnd(32),pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none',
            authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'}}});
        }
        if(u.pathname==='/auth/v1/passkeys/registration/verify'){
          const rt=RETOS[d.challenge_id];if(!rt||rt.tipo!=='reg'||rt.email!==quien)return J(400,{msg:'bad challenge'});
          PASSKEYS[d.credential.id]=quien;return J(200,{id:'pk-'+d.credential.id,created_at:new Date().toISOString()});
        }
        if(u.pathname==='/auth/v1/passkeys/authentication/options'){
          const id=rnd(12);RETOS[id]={tipo:'auth'};
          return J(200,{challenge_id:id,options:{challenge:rnd(32),rpId:'localhost',timeout:60000,userVerification:'required'}});
        }
        if(u.pathname==='/auth/v1/passkeys/authentication/verify'){
          const rt=RETOS[d.challenge_id],email=PASSKEYS[d.credential&&d.credential.id];
          if(!rt||rt.tipo!=='auth'||!email)return J(400,{msg:'passkey not found'});
          const s=sesion(email);TOKENS[s.access_token]=email;return J(200,s);
        }
        return J(200,{});
      }
      rest.push({m:q.method(),path:u.pathname,quien});
      if(u.pathname.startsWith('/rest/v1/rpc/'))return J(200,5);
      return r.fulfill({status:q.method()==='GET'?200:201,contentType:'application/json',body:'[]'});
    });
    await p.goto('http://localhost:8895/',{waitUntil:'load'});await p.waitForTimeout(1500);
    return p;
  }
  const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)process.exitCode=1;};
  const vis=async(p,s)=>p.isVisible(s).catch(()=>false);

  // --- 1) Teléfono nuevo: sin Face ID todavía
  let p=await nuevaPagina();
  await p.evaluate(()=>localStorage.setItem('sb-shlolncjhfzqmcllwjrk-auth-token','{"viejo":1}'));
  ok('Pantalla de entrar', await vis(p,'#loginScreen'));
  ok('Sin Face ID activado en este teléfono: no sale el botón', !(await vis(p,'#btnFaceId')));
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','clave-buena');await p.press('#loginPin','Enter');await p.waitForTimeout(2200);
  ok('Entra con contraseña (Enter en el formulario)', (await p.textContent('#quienSoy'))==='César (maestro)');
  ok('Ofrece activar Face ID después de entrar', await vis(p,'#modalRecibe.open')&&(await p.textContent('#modalRecibeBody')).includes('Activar en este teléfono'));
  ok('Arriba aparece "activar" junto a salir', await vis(p,'#lnkFaceId'));
  await p.click('#modalRecibeBody button:has-text("Activar en este teléfono")');await p.waitForTimeout(1500);
  ok('Face ID quedó registrado en Supabase para cesar', Object.values(PASSKEYS).filter(e=>e==='cesar@cobros.local').length===1);
  ok('Se cierra la ventanita y avisa', !(await vis(p,'#modalRecibe.open'))&&/activado/.test(await p.textContent('#toast')));
  ok('Ya no sale "activar" arriba', !(await vis(p,'#lnkFaceId')));
  await p.reload({waitUntil:'load'});await p.waitForTimeout(1500);
  ok('Se borró la sesión vieja guardada para siempre', await p.evaluate(()=>!localStorage.getItem('sb-shlolncjhfzqmcllwjrk-auth-token')));
  ok('Recargar (actualización) no pide entrar', await p.isHidden('#loginScreen'));
  await p._guardar();await p.close();

  // --- 2) Cerrar la app y abrirla: pide entrar, ahora con Face ID
  p=await nuevaPagina();
  ok('Al volver a abrir la app pide entrar (como antes)', await vis(p,'#loginScreen'));
  ok('Sale el botón "Entrar con Face ID / huella"', await vis(p,'#btnFaceId'));
  const r0=rest.length;
  ok('Sin entrar no lee la base', rest.length===r0);
  await p.click('#btnFaceId');await p.waitForTimeout(2200);
  ok('Entra con Face ID como César (maestro), sin escribir nada', (await p.textContent('#quienSoy'))==='César (maestro)'&&await p.isHidden('#loginScreen'));
  ok('Con Face ID todo va con la sesión de cesar', rest.length>r0&&rest.slice(r0).every(x=>x.quien==='cesar@cobros.local'));
  ok('No vuelve a ofrecer activar', !(await vis(p,'#modalRecibe.open')));
  await p.click('#btnSalir');await p.waitForTimeout(1500);
  ok('Salir: pide entrar otra vez', await vis(p,'#loginScreen'));

  // --- 3) Tienda en el mismo teléfono: "Ahora no"
  await p.fill('#loginUser','tienda');await p.fill('#loginPin','clave-tienda');await p.click('#loginForm button[type=submit]');await p.waitForTimeout(2200);
  ok('Tienda entra con contraseña como anotador', (await p.textContent('#quienSoy'))==='Tienda (anotador)');
  ok('A tienda también le ofrece activar', await vis(p,'#modalRecibe.open'));
  await p.click('#modalRecibeBody button:has-text("Ahora no")');await p.waitForTimeout(400);
  ok('"Ahora no" cierra y deja el enlace para después', !(await vis(p,'#modalRecibe.open'))&&await vis(p,'#lnkFaceId'));
  await p.click('#btnSalir');await p.waitForTimeout(1500);
  await p.fill('#loginUser','tienda');await p.fill('#loginPin','clave-tienda');await p.press('#loginPin','Enter');await p.waitForTimeout(2200);
  ok('Después de "Ahora no" ya no insiste al entrar', !(await vis(p,'#modalRecibe.open')));
  await p.click('#btnSalir');await p.waitForTimeout(1500);

  // --- 4) Si Supabase apaga la beta: la contraseña sigue
  ST.pkApagado=true;
  await p.click('#btnFaceId');await p.waitForTimeout(1500);
  ok('Beta apagada: avisa y no entra', await vis(p,'#loginScreen')&&/contraseña/.test(await p.textContent('#loginErr')));
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','clave-buena');await p.press('#loginPin','Enter');await p.waitForTimeout(2200);
  ok('Beta apagada: con contraseña entra igual', (await p.textContent('#quienSoy'))==='César (maestro)');
  await p.click('#btnSalir');await p.waitForTimeout(1500);
  ST.pkApagado=false;

  // --- 5) Contraseña mala sigue igual
  await p.fill('#loginUser','cesar');await p.fill('#loginPin','mala');await p.press('#loginPin','Enter');await p.waitForTimeout(1000);
  ok('Contraseña mala: no entra', (await p.textContent('#loginErr'))==='Contraseña incorrecta'&&await vis(p,'#loginScreen'));

  ok('El código no trae contraseñas', !/pass:'/.test(HTML)&&!/const USUARIOS/.test(HTML));
  ok('Sin errores de la página'+(errs.length?': '+errs.join(' | '):''), errs.length===0);
  await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
