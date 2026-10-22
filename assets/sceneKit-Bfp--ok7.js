import{o as e}from"./rolldown-runtime-BM3Ffeng.js";import{v as t}from"./react-vendor-a4q8X3V1.js";import{Bt as n,Ht as r,Kn as i,Un as a,bt as o,jn as s,mt as c,rt as l}from"./three-vendor-D06DcYSn.js";import{E as u,O as d}from"./compounds-data-yK-OAXDw.js";import{c as f,l as p,o as m,r as h,t as g}from"./atomicData-BIG793IN.js";import{m as _}from"./data-BItn1qq8.js";var v=e(t(),1),y=.285;function b(e){return e*y}function x(e){return e/100}var S=e=>x(h(e)),C=(e,t)=>x(m(e,t)),w=e=>x(f(e)),ee={H:g.H.cpk,C:g.C.cpk,N:g.N.cpk,O:g.O.cpk,F:g.F.cpk,Na:g.Na.cpk,Mg:g.Mg.cpk,Al:g.Al.cpk,Si:g.Si.cpk,P:g.P.cpk,S:g.S.cpk,Cl:g.Cl.cpk,K:g.K.cpk,Ca:g.Ca.cpk,V:g.V.cpk,Cr:g.Cr.cpk,Mn:g.Mn.cpk,Fe:g.Fe.cpk,Cu:g.Cu.cpk,Zn:g.Zn.cpk,Br:g.Br.cpk,Ag:g.Ag.cpk,I:g.I.cpk,Ba:g.Ba.cpk,Pb:g.Pb.cpk},te={H:S(`H`),C:S(`C`),N:S(`N`),O:S(`O`),F:S(`F`),Na:S(`Na`),Mg:S(`Mg`),Al:S(`Al`),Si:S(`Si`),P:S(`P`),S:S(`S`),Cl:S(`Cl`),K:S(`K`),Ca:S(`Ca`),V:S(`V`),Cr:S(`Cr`),Mn:S(`Mn`),Fe:S(`Fe`),Cu:S(`Cu`),Zn:S(`Zn`),Br:S(`Br`),Ag:S(`Ag`),I:S(`I`),Ba:S(`Ba`),Pb:S(`Pb`)};w(`Na`),w(`Mg`),w(`Al`),w(`K`),w(`Ca`),w(`V`),w(`Cr`),w(`Mn`),w(`Fe`),w(`Cu`),w(`Zn`),w(`Ag`),w(`Ba`),w(`Pb`),C(`H`,-1),C(`N`,-3),C(`O`,-2),C(`F`,-1),C(`Na`,1),C(`Mg`,2),C(`Al`,3),C(`S`,-2),C(`Cl`,-1),C(`K`,1),C(`Ca`,2),C(`V`,5),C(`Cr`,3),C(`Mn`,2),C(`Fe`,2),C(`Fe`,3),C(`Cu`,2),C(`Zn`,2),C(`Br`,-1),C(`Ag`,1),C(`I`,-1),C(`Ba`,2),C(`Pb`,2);var ne={ClO_radical:x(d(`Cl-O(ClO2)`)),ClO_chlorite:x(d(`Cl-O`)),ClCl:x(d(`Cl-Cl`)),NaCl:x(d(`Na-Cl`)),CH:x(d(`C-H`)),OO:x(d(`O=O`)),CO:x(d(`C=O(CO2)`)),OH:x(d(`O-H`)),HH:x(d(`H-H`)),HCl:x(d(`H-Cl`)),NN:x(d(`N#N`)),NH:x(d(`N-H`)),SO:x(d(`S=O`)),ZnCl:x(d(`Zn-Cl`)),FeS:x(d(`Fe-S`)),ZnS:x(d(`Zn-S`)),SO3:x(d(`S=O(SO3)`)),SiO:x(d(`Si-O`)),SiSi:x(d(`Si-Si`)),PbO:x(d(`Pb-O`)),OO_H2O2:x(d(`O-O`)),OH_H2O2:x(d(`O-H(H2O2)`)),OO_peroxide:x(d(`O-O(O2 2-)`)),MnO_term:x(d(`Mn-O(term)`)),MnO_bridge:x(d(`Mn-O(bridge)`)),MnO4:x(d(`Mn-O(MnO4)`)),ClO_term:x(d(`Cl-O(term)`)),ClO_bridge:x(d(`Cl-O(bridge)`))},re={clo2:u(`chlorineDioxide`),chlorite:u(`chlorite`),water:u(`water`),ammonia:u(`ammonia`),sulfurDioxide:u(`sulfurDioxide`),tetrahedral:u(`tetrahedral`),trigonalPlanar:u(`trigonalPlanar`),linear:u(`linear`),sulfurTrioxide:u(`sulfurTrioxide`),h2o2OOH:u(`hydrogenPeroxideOOH`),quartzSiOSi:u(`quartzSiOSi`),quartzOSiO:u(`quartzOSiO`),mn2o7MnOMn:u(`mn2o7MnOMn`),cl2o7ClOCl:u(`cl2o7ClOCl`),cl2o7OClO:u(`cl2o7OClO`)},ie={p:0,lonePair:1};function ae(e){return{capacity:e,count:0,version:0,position:new Float32Array(e*3),radius:new Float32Array(e),color:new Float32Array(e*3),emissive:new Float32Array(e),charge:new Float32Array(e),opacity:new Float32Array(e).fill(1),surface:new Float32Array(e*4)}}function oe(e){return{capacity:e,count:0,version:0,a:new Float32Array(e*3),b:new Float32Array(e*3),radius:new Float32Array(e).fill(.04),colorA:new Float32Array(e*3),colorB:new Float32Array(e*3),order:new Float32Array(e).fill(1),piNormal:new Float32Array(e*3),polarity:new Float32Array(e),opacity:new Float32Array(e).fill(1),form:new Float32Array(e).fill(1),stress:new Float32Array(e),thinning:new Float32Array(e),split:new Float32Array(e),dashStatic:new Float32Array(e)}}function se(e){return{capacity:e,count:0,version:0,center:new Float32Array(e*3),axis:new Float32Array(e*3),size:new Float32Array(e).fill(.3),coef:new Float32Array(e).fill(1),opacity:new Float32Array(e).fill(1),kind:new Float32Array(e),occupancy:new Float32Array(e).fill(1)}}function T(e,t,n){let r=e=>e<=.04045?e/12.92:((e+.055)/1.055)**2.4;e[t*3]=r((n>>16&255)/255),e[t*3+1]=r((n>>8&255)/255),e[t*3+2]=r((n&255)/255)}function E(e,t,n,r,i){e[t*3]=n,e[t*3+1]=r,e[t*3+2]=i}var ce={panels:[{name:`key`,center:[-3.2,3.6,4.6],size:[3.6,2.6],color:[1,.86,.7],intensity:9},{name:`rim`,center:[4.4,1.2,-4.2],size:[1.8,4.6],color:[.32,.82,1],intensity:5},{name:`floor`,center:[0,-3.2,0],size:[30,30],color:[.03,.035,.045],intensity:1},{name:`top`,center:[0,6,0],size:[9,9],color:[.55,.62,.78],intensity:.28}],background:[.006,.008,.014]};function le(e,t,n,r){r[0]=.282095,r[1]=.488603*t,r[2]=.488603*n,r[3]=.488603*e,r[4]=1.092548*e*t,r[5]=1.092548*t*n,r[6]=.315392*(3*n*n-1),r[7]=1.092548*e*n,r[8]=.546274*(e*e-t*t)}function ue(e){let[t,n,r]=e.center,i=Math.hypot(t,n,r)||1,a=-t/i,o=-n/i,s=-r/i,c,l,u;if(Math.abs(o)>.999)c=1,l=0,u=0;else{c=s,l=0,u=-a;let e=Math.hypot(c,u)||1;c/=e,u/=e}let d=o*u-s*l,f=s*c-a*u,p=a*l-o*c;return{cx:t,cy:n,cz:r,nx:a,ny:o,nz:s,rx:c,ry:l,rz:u,ux:d,uy:f,uz:p,halfW:e.size[0]/2,halfH:e.size[1]/2,r:e.color[0]*e.intensity,g:e.color[1]*e.intensity,b:e.color[2]*e.intensity}}function de(e,t,n,r,i,a=0){let o=pe(e),s=1/0,c=e.background[0],l=e.background[1],u=e.background[2];for(let e=0;e<o.length;e++){let i=o[e],a=t*i.nx+n*i.ny+r*i.nz;if(a>=-1e-9)continue;let d=(i.cx*i.nx+i.cy*i.ny+i.cz*i.nz)/a;if(d<=0||d>=s)continue;let f=t*d-i.cx,p=n*d-i.cy,m=r*d-i.cz,h=f*i.rx+p*i.ry+m*i.rz,g=f*i.ux+p*i.uy+m*i.uz;Math.abs(h)>i.halfW||Math.abs(g)>i.halfH||(s=d,c=i.r,l=i.g,u=i.b)}i[a]=c,i[a+1]=l,i[a+2]=u}var fe=new WeakMap;function pe(e){let t=fe.get(e);return t||(t=e.panels.map(ue),fe.set(e,t)),t}function me(e,t=32){let n=new Float64Array(27),r=new Float64Array(9),i=new Float64Array(3),a=0,o=Math.max(2,Math.floor(t)),s=2/o;for(let t=0;t<6;t++)for(let c=0;c<o;c++){let l=-1+(c+.5)*s;for(let c=0;c<o;c++){let o=-1+(c+.5)*s,u,d,f;switch(t){case 0:u=1,d=l,f=o;break;case 1:u=-1,d=l,f=o;break;case 2:u=o,d=1,f=l;break;case 3:u=o,d=-1,f=l;break;case 4:u=o,d=l,f=1;break;default:u=o,d=l,f=-1}let p=u*u+d*d+f*f,m=Math.sqrt(p),h=4/(m*p);a+=h;let g=u/m,_=d/m,v=f/m;de(e,g,_,v,i),le(g,_,v,r);for(let e=0;e<9;e++){let t=r[e]*h;n[e*3]+=t*i[0],n[e*3+1]+=t*i[1],n[e*3+2]+=t*i[2]}}}let c=4*Math.PI/a,l=new Float32Array(27);for(let e=0;e<27;e++)l[e]=n[e]*c;return l}function he(e,t=32){let n=me(e,t),r=e.panels[0];if(!r)return{sh:n,keyDir:[0,1,0],keyIrradiance:[0,0,0]};let[i,a,o]=r.center,s=i*i+a*a+o*o,c=Math.sqrt(s)||1,l=Math.min(2*Math.PI,r.size[0]*r.size[1]/Math.max(s,1e-6)),u=r.intensity*l;return{sh:n,keyDir:[i/c,a/c,o/c],keyIrradiance:[r.color[0]*u,r.color[1]*u,r.color[2]*u]}}var ge=null;function _e(){return ge||=he(ce),ge}function ve(e,t){let n=Math.max(0,Math.min(e.count,e.capacity,Math.floor(t.length/10))),r=e.position,i=e.color;for(let a=0;a<n;a++){let n=a*10,o=a*3;t[n]=r[o],t[n+1]=r[o+1],t[n+2]=r[o+2],t[n+3]=e.radius[a],t[n+4]=i[o],t[n+5]=i[o+1],t[n+6]=i[o+2],t[n+7]=e.opacity[a],t[n+8]=e.emissive[a],t[n+9]=e.charge[a]}return n}function ye(e,t){let n=Math.max(0,Math.min(e.count,e.capacity,Math.floor(t.length/4))),r=e.surface,i=n*4,a=r?Math.min(i,r.length):0;for(let e=0;e<a;e++)t[e]=r[e];for(let e=a;e<i;e++)t[e]=0;return n}var D={uSH:{value:new Float32Array(27)},uKeyDir:{value:new i(0,1,0)},uKeyColor:{value:new o(0,0,0)},uEnvIntensity:{value:1}},be=!1;function xe(){be||Se(_e())}function Se(e,t){D.uSH.value.set(e.sh);let[n,r,i]=e.keyDir;D.uKeyDir.value.set(n,r,i).normalize();let[a,o,s]=e.keyIrradiance;D.uKeyColor.value.setRGB(a,o,s),t!==void 0&&(D.uEnvIntensity.value=t),be=!0}function Ce(e,t){let n=e.uniforms.uViewportHeight;n&&n.value!==t&&(n.value=t)}var we=`
  uniform vec3 uSH[ 9 ];
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform float uEnvIntensity;

  // Облучённость из SH L2 (как shGetIrradianceAt в three.js).
  vec3 atomIrradiance( vec3 n ) {
    float x = n.x, y = n.y, z = n.z;
    vec3 r = uSH[ 0 ] * 0.886227;
    r += uSH[ 1 ] * 1.023328 * y;
    r += uSH[ 2 ] * 1.023328 * z;
    r += uSH[ 3 ] * 1.023328 * x;
    r += uSH[ 4 ] * 0.858086 * x * y;
    r += uSH[ 5 ] * 0.858086 * y * z;
    r += uSH[ 6 ] * ( 0.743125 * z * z - 0.247708 );
    r += uSH[ 7 ] * 0.858086 * x * z;
    r += uSH[ 8 ] * 0.429043 * ( x * x - y * y );
    return max( r, vec3( 0.0 ) );
  }

  // Процедурное окружение для металла (без текстур): небо над горизонтом, светлая
  // полоса горизонта, тёмный «пол» и широкий софтбокс ключа. Яркость и оттенок берутся
  // из SH окружения — металл отражает ту же комнату, что освещает остальные атомы, но с
  // контрастом, по которому глаз узнаёт металл (зеркальные полосы, а не ровный глянец).
  // rough размывает переходы; R — мировой единичный.
  vec3 atomMetalEnv( vec3 R, float rough ) {
    vec3 base = atomIrradiance( R ) * RECIPROCAL_PI;
    float lum = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 room = base + vec3( lum * 0.6 ); // отражение ахроматичнее диффуза
    float y = R.y;
    float blur = 0.03 + rough * 0.3;
    float sky = smoothstep( -blur, blur, y );
    // Небо темнеет к зениту, пол почти чёрный с едва заметным отражением «стола».
    float shape = mix( 0.06, 0.75 - 0.3 * clamp( y, 0.0, 1.0 ), sky );
    float yf = y + 0.35;
    shape += 0.25 * exp( -( yf * yf ) / ( blur * blur * 4.0 ) );
    // Резкая светлая линия горизонта — главный признак зеркального металла.
    shape += 2.8 * exp( -( y * y ) / ( blur * blur ) ) * ( 1.0 - 0.5 * rough );
    // Вторая, узкая полоса выше — «окно» комнаты: две линии блика читаются как металл.
    float y2 = y - 0.45;
    shape += 1.2 * exp( -( y2 * y2 ) / ( blur * blur * 0.5 ) ) * ( 1.0 - 0.6 * rough );
    float kd = max( dot( R, uKeyDir ), 0.0 );
    float sharp = mix( 140.0, 6.0, rough );
    vec3 box = uKeyColor * ( pow( kd, sharp ) * 0.9 );
    return room * shape + box;
  }

  // N, V — мировые единичные; V направлен к наблюдателю. occ — контактное затенение 0..1.
  // surf = aSurface (metalness, roughness, anisotropy, rimSoftness [+2 — газ]); roughness 0 — прежний набор.
  vec3 atomShade( vec3 N, vec3 V, vec3 albedo, float emissive, float charge, float occ, vec4 surf ) {
    float NoV = clamp( dot( N, V ), 0.0, 1.0 );
    float NoL = dot( N, uKeyDir );
    bool legacy = surf.y <= 0.0;
    float metal = legacy ? 0.0 : clamp( surf.x, 0.0, 1.0 );
    float soft = legacy ? 0.0 : clamp( surf.w >= 2.0 ? surf.w - 2.0 : surf.w, 0.0, 1.0 );

    // Диффуз: окружение (уже содержит мягкий ключ) + wrap от ключа для формы.
    // У металла диффуза почти нет — свет уходит в окрашенное отражение.
    float wrap = NoL * 0.5 + 0.5;
    wrap *= wrap;
    vec3 ambient = atomIrradiance( N ) * ( uEnvIntensity * RECIPROCAL_PI );
    vec3 keyWrap = uKeyColor * ( wrap * 0.16 * uEnvIntensity );
    vec3 diffuse = albedo * ( ambient * occ + keyWrap * mix( 1.0, occ, 0.6 ) + 0.03 ) * ( 1.0 - 0.94 * metal );

    vec3 H = normalize( uKeyDir + V );
    float NoH = clamp( dot( N, H ), 0.0, 1.0 );
    vec3 spec;
    vec3 envSpec;
    if ( legacy ) {
      // Небольшой GGX-блик ключа (roughness ≈ 0.4) — «стекло», не хром.
      const float a2 = 0.026;
      float dd = NoH * NoH * ( a2 - 1.0 ) + 1.0;
      float D = min( a2 / ( PI * dd * dd ), 9.0 );
      float fres = 0.04 + 0.96 * pow( 1.0 - NoV, 5.0 );
      spec = uKeyColor * ( D * clamp( NoL, 0.0, 1.0 ) * 0.03 * uEnvIntensity );
      envSpec = atomIrradiance( reflect( -V, N ) ) * ( uEnvIntensity * RECIPROCAL_PI * fres * occ );
    } else {
      // Материал по типу вещества: F0 = 0.04 у диэлектрика, F0 = albedo у металла.
      float rough = clamp( surf.y, 0.04, 1.0 );
      float aniso = clamp( surf.z, 0.0, 0.9 );
      float ar = max( rough * rough, 0.002 );
      // Анизотропный GGX: блик вытянут вдоль «широт» вокруг вертикали, как у
      // шлифованного металла; при aniso = 0 — обычный изотропный GGX.
      vec3 Tg = cross( vec3( 0.0, 1.0, 0.0 ), N );
      Tg = dot( Tg, Tg ) > 1e-6 ? normalize( Tg ) : vec3( 1.0, 0.0, 0.0 );
      vec3 Bg = cross( N, Tg );
      float ax = ar * ( 1.0 + aniso );
      float ay = ar * ( 1.0 - 0.8 * aniso );
      float th = dot( Tg, H ) / ax;
      float bh = dot( Bg, H ) / ay;
      float den = th * th + bh * bh + NoH * NoH;
      float D = min( 1.0 / ( PI * ax * ay * den * den ), 16.0 );
      // F0 металла = albedo (CPK — «паспорт» элемента), на 35 % сведённый к нейтральному
      // серебру той же яркости: Na — фиолетово-серебристый, Mg — зелёно-серебристый,
      // Al — серебристо-серый, Pb — тёмно-серый (пол 0.22 — иначе Pb на тёмной сцене чёрный).
      float amax = max( max( albedo.r, albedo.g ), albedo.b );
      vec3 metalF0 = max( mix( albedo, vec3( amax ), 0.35 ), vec3( 0.22 ) );
      vec3 F0 = mix( vec3( 0.04 ), metalF0, metal );
      vec3 fresV = F0 + ( 1.0 - F0 ) * pow( 1.0 - NoV, 5.0 );
      vec3 specTint = mix( vec3( 1.0 ), metalF0, metal );
      spec = uKeyColor * specTint * ( D * clamp( NoL, 0.0, 1.0 ) * mix( 0.03, 0.12, metal ) * uEnvIntensity );
      // Отражение окружения. Диэлектрик (metal = 0) — прежнее размытое SH-отражение бит в бит.
      // Металл — процедурная карта по отражённому вектору, согнутому анизотропией: блик и
      // полосы горизонта тянутся вдоль «широт» (шлифованный металл, Filament bent normal).
      vec3 envDiel = atomIrradiance( reflect( -V, N ) ) * RECIPROCAL_PI * mix( 1.0, 0.55, rough );
      vec3 envCol = envDiel;
      if ( metal > 0.0 ) {
        vec3 aT = cross( Tg, V );
        vec3 aN = cross( aT, Tg );
        vec3 Nb = normalize( mix( N, aN, aniso * 0.6 ) );
        vec3 envMetal = atomMetalEnv( reflect( -V, Nb ), rough ) * 1.8;
        envCol = mix( envDiel, envMetal, metal );
      }
      envSpec = envCol * fresV * ( uEnvIntensity * occ );
    }

    // Кромка: цвет элемента, заряд смещает оттенок. Мягкий ободок (ион, газ) —
    // шире и светлее, без жёсткого края.
    float rim = pow( 1.0 - NoV, mix( 3.0, 1.7, soft ) );
    float q = clamp( charge, -1.0, 1.0 );
    vec3 qTint = q < 0.0 ? vec3( 0.30, 0.86, 1.0 ) : vec3( 1.0, 0.62, 0.24 );
    vec3 rimCol = mix( mix( albedo, vec3( 1.0 ), 0.3 ), qTint, abs( q ) * 0.7 );
    // Ион (мягкий матовый материал, не газ) — ободок слабый, как френель матового тела, без
    // «неонового» свечения края: заряд лишь чуть подкрашивает кромку (приёмка NaCl, шаги 3–4).
    float ionLike = ( legacy || surf.w >= 2.0 ) ? 0.0 : soft * ( 1.0 - metal ) * smoothstep( 0.6, 0.75, surf.y );
    float rimAmp = mix( 0.22 + 0.3 * abs( q ), 0.12 + 0.08 * abs( q ), ionLike );
    vec3 rimLight = rimCol * ( rim * rimAmp * ( 1.0 + 0.35 * soft ) * ( 1.0 - 0.6 * metal ) );

    // Собственное свечение: ≤ 1 ровное, > 1 — энергия, центр разгорается в белое.
    float e = max( emissive, 0.0 );
    float hot = max( e - 1.0, 0.0 );
    float core = mix( 0.7, 1.2, NoV * NoV );
    vec3 glowCol = mix( albedo, vec3( 1.0 ), clamp( hot * 0.5, 0.0, 0.6 ) * NoV );
    vec3 glow = glowCol * ( ( min( e, 1.0 ) * 0.3 + hot * 1.4 ) * core );

    return diffuse + spec + envSpec + rimLight + glow;
  }

  #ifdef ATOM_CONTACT
    // Аналитическое затенение от сферы-соседа (сосед в системе вида, от центра C).
    float atomContactTerm( vec3 P, vec3 N, vec3 C, vec4 nb ) {
      vec3 di = C + nb.xyz - P;
      float l2 = max( dot( di, di ), 1e-6 );
      float o = max( dot( N, di ), 0.0 ) * inversesqrt( l2 ) * ( nb.w * nb.w ) / l2;
      return 1.0 - clamp( o, 0.0, 1.0 ) * 0.8;
    }
  #endif
`,Te=`
  #ifdef ATOM_CONTACT
    attribute vec4 aNeighbor0;
    attribute vec4 aNeighbor1;
    attribute vec4 aNeighbor2;
    attribute vec4 aNeighbor3;
    varying vec4 vNeighbor0;
    varying vec4 vNeighbor1;
    varying vec4 vNeighbor2;
    varying vec4 vNeighbor3;
  #endif
`,Ee=`
  #ifdef ATOM_CONTACT
    mat3 mv3 = mat3( modelViewMatrix );
    vNeighbor0 = vec4( mv3 * aNeighbor0.xyz, aNeighbor0.w * scale );
    vNeighbor1 = vec4( mv3 * aNeighbor1.xyz, aNeighbor1.w * scale );
    vNeighbor2 = vec4( mv3 * aNeighbor2.xyz, aNeighbor2.w * scale );
    vNeighbor3 = vec4( mv3 * aNeighbor3.xyz, aNeighbor3.w * scale );
  #endif
`,De=`
  #ifdef ATOM_CONTACT
    varying vec4 vNeighbor0;
    varying vec4 vNeighbor1;
    varying vec4 vNeighbor2;
    varying vec4 vNeighbor3;
  #endif
`,Oe=`
  float occ = 1.0;
  #ifdef ATOM_CONTACT
    occ *= atomContactTerm( P, Nv, C, vNeighbor0 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor1 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor2 );
    occ *= atomContactTerm( P, Nv, C, vNeighbor3 );
  #endif
`,ke=`
  attribute vec4 aSphere;
  attribute vec4 aColor;
  attribute vec2 aEnergy;
  attribute vec4 aSurface;
  uniform float uViewportHeight;
  varying vec3 vRayPos;
  varying vec4 vSphere;
  varying vec4 vColor;
  varying vec2 vEnergy;
  varying vec4 vSurface;
  ${Te}
  #include <fog_pars_vertex>

  void main() {
    vec3 C = ( modelViewMatrix * vec4( aSphere.xyz, 1.0 ) ).xyz;
    // Риг сцены масштабирует мир равномерно — радиус масштабируется так же.
    float scale = length( modelViewMatrix[ 0 ].xyz );
    float r = aSphere.w * scale;
    vColor = aColor;
    vEnergy = aEnergy;
    vSurface = aSurface;
    vSphere = vec4( C, r );
    ${Ee}

    if ( r <= 0.0 || aColor.a <= 0.003 ) {
      // Невидимый атом: вырожденный квад за дальней плоскостью, растеризатор его отбросит.
      vRayPos = C;
      gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
      return;
    }

    bool persp = projectionMatrix[ 2 ][ 3 ] == -1.0;
    vec3 toCam = persp ? -C : vec3( 0.0, 0.0, 1.0 );
    float d2 = max( dot( toCam, toCam ), 1e-8 );
    vec3 fwd = toCam * inversesqrt( d2 );
    // Квад в плоскости через центр ⟂ лучу на центр. Сечение касательного конуса
    // этой плоскостью — ровно окружность r / sqrt(1 − r²/d²): силуэт в перспективе
    // покрыт без запаса «на глаз», даже у края кадра.
    float grow = persp ? inversesqrt( max( 1.0 - r * r / d2, 0.04 ) ) : 1.0;
    float depth = persp ? max( -C.z, 1e-4 ) : 1.0;
    float px = 2.0 * depth / ( projectionMatrix[ 1 ][ 1 ] * max( uViewportHeight, 1.0 ) );
    // Запас ~1.25 px — ровно под полосу AA силуэта.
    float ext = r * grow + 1.25 * px;

    vec3 up0 = abs( fwd.y ) > 0.99 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
    vec3 right = normalize( cross( up0, fwd ) );
    vec3 up = cross( fwd, right );
    vRayPos = C + ( right * position.x + up * position.y ) * ext;
    gl_Position = projectionMatrix * vec4( vRayPos, 1.0 );

    // Туман считается по передней точке сферы, а не по плоскости квада.
    vec4 mvPosition = vec4( vRayPos.xy, C.z + r, 1.0 );
    #include <fog_vertex>
  }
`,Ae=`
  #include <common>
  // В префиксе фрагментного шейдера three матрицы проекции нет — нужна для gl_FragDepth.
  uniform mat4 projectionMatrix;
  varying vec3 vRayPos;
  varying vec4 vSphere;
  varying vec4 vColor;
  varying vec2 vEnergy;
  varying vec4 vSurface;
  ${De}
  #include <fog_pars_fragment>
  #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
    uniform float logDepthBufFC;
  #endif
  ${we}

  // Упорядоченный порог Байера 4×4: 0..15/16.
  float atomBayer2( vec2 a ) {
    a = floor( a );
    return fract( a.x * 0.5 + a.y * a.y * 0.75 );
  }
  float atomBayer4( vec2 a ) {
    return atomBayer2( 0.5 * a ) * 0.25 + atomBayer2( a );
  }

  void main() {
    vec3 C = vSphere.xyz;
    float r = vSphere.w;
    vec3 ro = isOrthographic ? vec3( vRayPos.xy, 0.0 ) : vec3( 0.0 );
    vec3 rd = isOrthographic ? vec3( 0.0, 0.0, -1.0 ) : normalize( vRayPos );

    // Пересечение луча со сферой в устойчивой форме (без вычитания больших чисел).
    vec3 oc = ro - C;
    float b = dot( oc, rd );
    vec3 qv = oc - b * rd;
    float h = r * r - dot( qv, qv );

    // Покрытие силуэта: h ≈ 2r·(расстояние до края) — линейно по пикселю.
    float cov = clamp( h / max( fwidth( h ), 1e-10 ) + 0.5, 0.0, 1.0 );
    if ( cov <= 0.0 ) discard;

    float t = -b - sqrt( max( h, 0.0 ) );
    if ( t <= 0.0 ) discard; // камера внутри атома
    vec3 P = ro + rd * t;
    vec3 Nv = normalize( P - C );

    // Непрозрачность < 1 — screen-door: порядок отрисовки не важен, сортировка не нужна.
    // «Газ» (aSurface.w ≥ 2) — без узора: альфа уходит в смешивание. Глубина пишется,
    // поэтому газовую молекулу ставят отдельно, а не перед другими атомами.
    bool gasBlend = vSurface.y > 0.0 && vSurface.w >= 2.0;
    if ( !gasBlend && vColor.a < 0.999 && vColor.a <= atomBayer4( gl_FragCoord.xy ) + 0.03125 ) discard;

    // Полупокрытая кромка пишет глубину позади сферы: сосед, нарисованный позже
    // в том же батче, перекроет её целиком, а не оставит тёмный ореол.
    vec3 Pd = cov < 0.999 ? P + rd * r : P;
    vec4 clip = projectionMatrix * vec4( Pd, 1.0 );
    #if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
      gl_FragDepth = log2( 1.0 + clip.w ) * logDepthBufFC * 0.5;
    #elif defined( USE_REVERSED_DEPTH_BUFFER )
      gl_FragDepth = clip.z / clip.w;
    #else
      gl_FragDepth = ( clip.z / clip.w ) * 0.5 + 0.5;
    #endif

    ${Oe}

    vec3 N = normalize( ( vec4( Nv, 0.0 ) * viewMatrix ).xyz );
    vec3 V = normalize( ( vec4( -rd, 0.0 ) * viewMatrix ).xyz );
    vec3 col = atomShade( N, V, vColor.rgb, vEnergy.x, vEnergy.y, occ, vSurface );

    gl_FragColor = vec4( col, gasBlend ? cov * clamp( vColor.a, 0.0, 1.0 ) : cov );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`,je=`
  attribute vec4 aSphere;
  attribute vec4 aColor;
  attribute vec2 aEnergy;
  attribute vec4 aSurface;
  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec3 vCenter;
  varying vec4 vColor;
  varying vec2 vEnergy;
  varying vec4 vSurface;
  ${Te}
  #include <fog_pars_vertex>

  void main() {
    vec3 C = ( modelViewMatrix * vec4( aSphere.xyz, 1.0 ) ).xyz;
    float scale = length( modelViewMatrix[ 0 ].xyz );
    // Без discard прозрачность не изобразить: исчезающий атом слегка сжимается
    // (и темнеет во фрагменте), при opacity≈0 схлопывается в точку.
    float fade = aColor.a <= 0.003 ? 0.0 : mix( 0.6, 1.0, clamp( aColor.a, 0.0, 1.0 ) );
    float r = aSphere.w * scale * fade;
    vColor = aColor;
    vEnergy = aEnergy;
    vSurface = aSurface;
    vCenter = C;
    ${Ee}
    // Икосфера сферически симметрична — строим её прямо в системе вида.
    vNormalV = position;
    vViewPos = C + position * r;
    vec4 mvPosition = vec4( vViewPos, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`,Me=`
  #include <common>
  varying vec3 vViewPos;
  varying vec3 vNormalV;
  varying vec3 vCenter;
  varying vec4 vColor;
  varying vec2 vEnergy;
  varying vec4 vSurface;
  ${De}
  #include <fog_pars_fragment>
  ${we}

  void main() {
    vec3 Nv = normalize( vNormalV );
    vec3 P = vViewPos;
    vec3 C = vCenter;
    vec3 rd = isOrthographic ? vec3( 0.0, 0.0, -1.0 ) : normalize( vViewPos );
    ${Oe}
    vec3 N = normalize( ( vec4( Nv, 0.0 ) * viewMatrix ).xyz );
    vec3 V = normalize( ( vec4( -rd, 0.0 ) * viewMatrix ).xyz );
    vec3 col = atomShade( N, V, vColor.rgb, vEnergy.x, vEnergy.y, occ, vSurface );
    col *= mix( 0.3, 1.0, clamp( vColor.a, 0.0, 1.0 ) );
    gl_FragColor = vec4( col, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;function Ne(e,t={}){xe();let n={};t.contact&&(n.ATOM_CONTACT=``);let r={...a.clone(l.fog),uSH:D.uSH,uKeyDir:D.uKeyDir,uKeyColor:D.uKeyColor,uEnvIntensity:D.uEnvIntensity,uViewportHeight:{value:1080}};return e===`impostor`?new s({name:`CinemaAtomImpostor`,defines:n,uniforms:r,vertexShader:ke,fragmentShader:Ae,fog:!0,transparent:!1,depthWrite:!0,depthTest:!0,side:2,blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:201,blendDstAlpha:205}):new s({name:`CinemaAtomMesh`,defines:n,uniforms:r,vertexShader:je,fragmentShader:Me,fog:!0,transparent:!1,depthWrite:!0,depthTest:!0})}function Pe(){let e=new r;return e.setAttribute(`position`,new c(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),e.setIndex([0,1,2,0,2,3]),e}var O=null;function Fe(){if(O)return O;let e=new n(1,4),t=e.getAttribute(`position`),r=new Map,i=[],a=new Uint16Array(t.count);for(let e=0;e<t.count;e++){let n=t.getX(e),o=t.getY(e),s=t.getZ(e),c=`${Math.round(n*1e4)}_${Math.round(o*1e4)}_${Math.round(s*1e4)}`,l=r.get(c);if(l===void 0){l=i.length/3;let e=Math.hypot(n,o,s)||1;i.push(n/e,o/e,s/e),r.set(c,l)}a[e]=l}return e.dispose(),O={position:new Float32Array(i),index:a},O}function Ie(){let{position:e,index:t}=Fe(),n=new r;return n.setAttribute(`position`,new c(e,3)),n.setIndex(new c(t,1)),n}var k={metal:{kind:`metal`,metalness:1,roughness:.2,anisotropy:.55,rimSoftness:.1,translucent:!1,lighten:0,opacityScale:1},ion:{kind:`ion`,metalness:0,roughness:.78,anisotropy:0,rimSoftness:1,translucent:!1,lighten:0,opacityScale:1},covalent:{kind:`covalent`,metalness:0,roughness:.26,anisotropy:0,rimSoftness:.2,translucent:!1,lighten:0,opacityScale:1},polar:{kind:`polar`,metalness:0,roughness:.45,anisotropy:0,rimSoftness:.55,translucent:!1,lighten:0,opacityScale:1},gas:{kind:`gas`,metalness:0,roughness:.5,anisotropy:0,rimSoftness:.7,translucent:!0,lighten:.16,opacityScale:.82},default:{kind:`default`,metalness:0,roughness:0,anisotropy:0,rimSoftness:0,translucent:!1,lighten:0,opacityScale:1}};for(let e of Object.keys(k))Object.freeze(k[e]);function Le(e){return k[e]??k.default}var Re=k.default;function ze(e,t,n){let r=e.surface;if(!r)return;let i=t*4,a=n??Re;r[i]=a.metalness,r[i+1]=a.roughness,r[i+2]=a.anisotropy,r[i+3]=a.translucent?2+a.rimSoftness:a.rimSoftness}var Be=.72,Ve=Be*.7;function He(e,t=0){return p(e,t)}function Ue(e,t=0,n=Be){return b(x(p(e,t)))*n}function We(e){return g[e].cpk}function Ge(e){return b(x(d(e)))}function A(e){return b(x(e))}var Ke={0:`⁰`,1:`¹`,2:`²`,3:`³`,4:`⁴`};function qe(e,t=0){if(t===0)return e;let n=Math.abs(t);return`${e}${n===1?``:String(n).split(``).map(e=>Ke[e]??e).join(``)}${t>0?`⁺`:`⁻`}`}function Je(e,t,n){E(e.position,t,n.pos.x,n.pos.y,n.pos.z),e.radius[t]=n.radius,e.charge[t]=n.charge??0,e.emissive[t]=n.emissive??.08;let r=n.surface;if(e.opacity[t]=(n.opacity??1)*(r?r.opacityScale:1),T(e.color,t,n.colorHex),r&&r.lighten>0){let n=t*3,i=e.color;i[n]=i[n]+(1-i[n])*r.lighten,i[n+1]=i[n+1]+(1-i[n+1])*r.lighten,i[n+2]=i[n+2]+(1-i[n+2])*r.lighten}ze(e,t,r)}function Ye(e,t,n){E(e.a,t,n.a.x,n.a.y,n.a.z),E(e.b,t,n.b.x,n.b.y,n.b.z),e.radius[t]=n.radius,T(e.colorA,t,n.colorA),T(e.colorB,t,n.colorB),e.order[t]=n.order??1,e.opacity[t]=n.opacity??1,e.form[t]=n.form??1,e.stress[t]=n.stress??0,e.thinning[t]=n.thinning??0,e.split[t]=n.split??0,e.polarity[t]=n.polarity??0,E(e.piNormal,t,0,0,0),e.dashStatic&&(e.dashStatic[t]=+!!n.dashStatic)}function Xe(e,t){e.count=t,e.version++}var j=1,M=0,N=0,P=1,Ze=1e-4;function Qe(e,t,n){if(!(n>0)){j=1,M=0,N=0,P=1;return}if(!(e>0)){j=1,M=n,N=0,P=1;return}let r=t>0?t:0;if(Math.abs(r-1)<Ze){let t=e*n,r=Math.exp(-t);j=(1+t)*r,M=n*r,N=-e*e*n*r,P=(1-t)*r}else if(r<1){let t=e*Math.sqrt(1-r*r),i=Math.exp(-r*e*n),a=Math.cos(t*n),o=Math.sin(t*n)/t;j=i*(a+r*e*o),M=i*o,N=-i*e*e*o,P=i*(a-r*e*o)}else{let t=Math.sqrt(r*r-1),i=-e/(r+t),a=-e*(r+t),o=Math.exp(i*n),s=Math.exp(a*n),c=1/(i-a);j=(i*s-a*o)*c,M=(o-s)*c,N=i*a*(s-o)*c,P=(i*o-a*s)*c}}function $e(e,t,n,r,i){Qe(n,r,i);let a=e.x-t,o=e.v;e.x=t+j*a+M*o,e.v=N*a+P*o}function et(e,t,n,r){return t+(e-t)*Math.exp(-n*r)}function tt(e,t=60){return-Math.log(1-e)*t}function nt(){return{cx:0,cy:0,left:0,right:0,top:0,bottom:0,fit:1,counter:0,ready:!1,ox:0,oy:0}}var rt=tt(.08,60);function it(e,t,n,r,i,a,o){e.left=r,e.right=i,e.top=a,e.bottom=o,e.cx=(r+i)/2,e.cy=(a+o)/2;let s=Math.min((i-r)/t,(o-a)/n);e.fit=Math.max(.88,Math.min(1,.55+.45*s)),e.ready=!0}function F(e,t){let n=t.getBoundingClientRect();if(n.width<10||n.height<10)return;let r=n.left,i=n.right,a=n.top+Math.min(90,n.height*.1),o=n.bottom,s=document.querySelector(`[data-lab-reactor]`);if(s){let e=s.getBoundingClientRect();e.height>0&&e.top>n.top+n.height*.35&&e.top<o&&(o=e.top)}let c=document.querySelector(`[data-lab-lesson-panel]`);if(c){let e=c.getBoundingClientRect();e.width>0&&e.height>0&&(e.width>n.width*.8||e.top>n.top+n.height*.5?o=Math.min(o,e.top):e.left<n.left+n.width*.5?r=Math.max(r,e.right):i=Math.min(i,e.left))}o-a<n.height*.3&&(a=n.top),it(e,n.width,n.height,r-n.left,i-n.left,a-n.top,o-n.top)}var I=[],at=[],L;function ot(){for(let e=0;e<I.length;e++){let t=I[e],n=at[e];t.queued=!1,n.isConnected&&F(t,n)}I.length=0,at.length=0}function st(e,t){if(!e.queued){if(L===void 0)if(typeof MessageChannel==`function`){let e=new MessageChannel;e.port1.onmessage=ot,L=e.port2}else L=null;if(!L){F(e,t);return}e.queued=!0,I.push(e),at.push(t),I.length===1&&L.postMessage(0)}}var R=new i,ct=new i;function lt(e,t,n,r){t.counter++%20==0&&(t.ready?st(t,r.canvas):F(t,r.canvas));let i=t.ready?t.fit:1;if(e.zoom=n.zoom*i,e.offset.copy(n.offset).multiplyScalar(i),t.ready){R.set(0,0,0).project(r.camera),ct.set(1,0,0).project(r.camera);let n=Math.abs(ct.x-R.x)*.5*r.width;if(n>.001){let i=(t.cx-(R.x*.5+.5)*r.width)/n,a=-(t.cy-(-R.y*.5+.5)*r.height)/n,o=Math.min(.1,Math.max(0,r.dt??1/60));t.ox=et(t.ox,i,rt,o),t.oy=et(t.oy,a,rt,o),e.offset.x+=t.ox,e.offset.y+=t.oy}}e.yaw=n.yaw,e.pitch=n.pitch??0,e.roll=n.roll,e.shake=n.shake}function ut(e,t=1){return{center:new i,opacity:0,spread:t,rise:0,turbulence:.12,color:new o(e)}}function dt(e,t=1.6){return{center:new i,amount:0,radius:t,color:new o(e)}}function ft(){return{center:new i,amount:0}}function pt(){return{zoom:1,offset:new i,roll:0,yaw:0,pitch:0,shake:0}}function mt(e,t,n=0){e.rotation.set(t.pitch??0,t.yaw,t.roll+n,`YXZ`)}function ht(){return{bloom:.35,vignette:.35}}function gt(e){return e.length>0?e[e.length-1].to:0}function _t(e){let t=0;for(let n of e)t+=n.wall;return t}var z=e=>e<0?0:e>1?1:e,B={linear:e=>z(e),smooth:e=>{let t=z(e);return t*t*(3-2*t)},smoother:e=>{let t=z(e);return t*t*t*(t*(t*6-15)+10)},inQuad:e=>{let t=z(e);return t*t},outQuad:e=>{let t=z(e);return 1-(1-t)*(1-t)},inCubic:e=>{let t=z(e);return t*t*t},outCubic:e=>1-(1-z(e))**3,inOutCubic:e=>{let t=z(e);return t<.5?4*t*t*t:1-(-2*t+2)**3/2},outQuart:e=>1-(1-z(e))**4,inExpo:e=>{let t=z(e);return t<=0?0:2**(10*t-10)},outExpo:e=>{let t=z(e);return t>=1?1:1-2**(-10*t)},inSine:e=>1-Math.cos(z(e)*Math.PI/2),outSine:e=>Math.sin(z(e)*Math.PI/2),step:e=>+(e>=1),inOutSine:e=>-(Math.cos(Math.PI*z(e))-1)/2,outBack:e=>{let t=z(e),n=1.70158;return 1+(n+1)*(t-1)**3+n*(t-1)**2},outElastic:e=>{let t=z(e);if(t===0||t===1)return t;let n=2*Math.PI/3;return 2**(-10*t)*Math.sin((t*10-.75)*n)+1},spike:e=>{let t=z(e);return Math.sin(Math.PI*t)},flash:e=>{let t=z(e);return t<.14?t/.14:(1-(t-.14)/.86)**2.2}};function vt(e,t){return(e?B[e]:B.smooth)(t)}function yt(e,t,n){return e+(t-e)*n}function V(e,t,n){let r=t-e;return r===0?+(n>=t):z((n-e)/r)}function bt(e,t,n){return B.smooth(V(e,t,n))}var xt=new i,St=new i,Ct=new i,wt=new i,H=new i;function Tt(e,t,n){for(let r=1;r<e;r++)if(n<t(r))return r;return e-1}function U(e,t,n,r,i){let a=i*i,o=a*i;return(2*o-3*a+1)*e+(o-2*a+i)*t+(-2*o+3*a)*n+(o-a)*r}function Et(e,t,n,r,i,a){let o=n-e,s=i-n,c=(r-t)/o,l=(a-r)/s;return(s*c+o*l)/(o+s)}function Dt(e,t){let n=e.length;if(t<=0||t>=n-1)return 0;let r=e[t],i=e[t+1];if(r.interp!==`hermite`||i.interp!==`hermite`)return 0;let a=e[t-1],o=(r.v-a.v)/(r.t-a.t),s=(i.v-r.v)/(i.t-r.t);if(o*s<=0)return 0;let c=Et(a.t,a.v,r.t,r.v,i.t,i.v),l=3*Math.min(Math.abs(o),Math.abs(s));return Math.abs(c)>l?Math.sign(c)*l:c}function W(e,t,n){let r=e.length;if(t<=0||t>=r-1)return 0;let i=e[t],a=e[t+1];if(i.interp!==`hermite`||a.interp!==`hermite`)return 0;let o=e[t-1];return Et(o.t,o.v[n],i.t,i.v[n],a.t,a.v[n])}function Ot(e,t){let n=e.length;if(n===0)return 0;let r=e[0];if(n===1||t<=r.t)return r.v;let i=e[n-1];if(t>=i.t)return i.v;let a=Tt(n,t=>e[t].t,t),o=e[a-1],s=e[a];if(s.interp===`hermite`){let n=s.t-o.t,r=V(o.t,s.t,t);return U(o.v,Dt(e,a-1)*n,s.v,Dt(e,a)*n,r)}return yt(o.v,s.v,vt(s.ease,V(o.t,s.t,t)))}function kt(e,t,n){let r=e.length;if(r===0)return n.set(0,0,0);let i=e[0];if(r===1||t<=i.t)return n.set(i.v[0],i.v[1],i.v[2]);let a=e[r-1];if(t>=a.t)return n.set(a.v[0],a.v[1],a.v[2]);let o=Tt(r,t=>e[t].t,t),s=e[o-1],c=e[o];xt.set(s.v[0],s.v[1],s.v[2]),St.set(c.v[0],c.v[1],c.v[2]);let l;if(c.interp===`hermite`){let r=c.t-s.t,i=V(s.t,c.t,t);n.set(U(s.v[0],W(e,o-1,0)*r,c.v[0],W(e,o,0)*r,i),U(s.v[1],W(e,o-1,1)*r,c.v[1],W(e,o,1)*r,i),U(s.v[2],W(e,o-1,2)*r,c.v[2],W(e,o,2)*r,i));let a=Math.sin(Math.PI*i);l=a*a}else{let e=vt(c.ease,V(s.t,c.t,t));n.copy(xt).lerp(St,e),l=Math.sin(Math.PI*e)}let u=c.arc;if(u&&(Ct.copy(St).sub(xt),Ct.lengthSq()>1e-10)){let e=c.arcAxis;wt.set(e?e[0]:0,e?e[1]:1,e?e[2]:0),H.copy(Ct).normalize().cross(wt),H.lengthSq()<1e-8?H.set(0,1,0):H.normalize(),n.addScaledVector(H,l*u)}return n}function At(e,t,n=.12){if(t<=e[0]||t>=e[1])return 0;let r=V(e[0],e[0]+n,t),i=1-V(e[1]-n,e[1],t);return Math.min(r,i)}function jt(e,t){return Math.sin(e*(5.13+t*1.7)+t*12.9898)*.6+Math.sin(e*(9.71+t*.9)+t*78.233)*.4}function Mt(e,t){for(let n=1;n<t.length;n++)if(t[n].t<=t[n-1].t)throw Error(`[cinema] track "${e}": keys must be strictly increasing (index ${n})`)}var G=1e-6,Nt=new Map;function K(e){let t=_(e);if(!t)throw Error(`[lattice] нет кристалла «${e}» в crystalData`);if(!t.basis||t.basis.length===0)throw Error(`[lattice] у кристалла «${e}» нет basis`);return t}function q(e){let t=Nt.get(e);if(t)return t;let n=K(e),r=n.setting??`cubic`,i=n.cellPm.a,a=n.cellPm.b??i,o=n.cellPm.c??(r===`cubic`?i:NaN);if(!Number.isFinite(o))throw Error(`[lattice] у «${e}» (${r}) не задан параметр c`);let s=r===`hexagonal`||r===`rhombohedral-hex`,c=n.cellAnglesDeg??{alpha:90,beta:90,gamma:s?120:90},l=Math.PI/180,u=Math.cos(c.alpha*l),d=Math.cos(c.beta*l),f=Math.cos(c.gamma*l),p=Math.sin(c.gamma*l),m=o*d,h=o*(u-d*f)/p,g=Math.sqrt(Math.max(0,o*o-m*m-h*h)),_={a:[i,0,0],b:[a*f,0,-a*p],c:[m,g,-h]};return Nt.set(e,_),_}function J(e,t,n=[0,0,0]){return n[0]=t[0]*e.a[0]+t[1]*e.b[0]+t[2]*e.c[0],n[1]=t[0]*e.a[1]+t[1]*e.b[1]+t[2]*e.c[1],n[2]=t[0]*e.a[2]+t[1]*e.b[2]+t[2]*e.c[2],n}function Y(e,t){let n=e[0]-t[0],r=e[1]-t[1],i=e[2]-t[2];return Math.sqrt(n*n+r*r+i*i)}var Pt=new Map;function Ft(e,t){let n=`${e}|${t??``}`,r=Pt.get(n);if(r)return r;let i=K(e),a=q(e),o=[a.a,a.b,a.c].map(e=>Math.hypot(e[0],e[1],e[2])),s=Math.max(t??0,2*Math.min(...o)),c=o.map(e=>Math.ceil(s/e)+1),l=i.basis.map(e=>J(a,e.frac)),u=[],d=[0,0,0],f=[0,0,0];for(let e=0;e<i.basis.length;e++){let n=[];for(let t=-c[0];t<=c[0];t++)for(let r=-c[1];r<=c[1];r++)for(let o=-c[2];o<=c[2];o++){J(a,[t,r,o],d);for(let t=0;t<i.basis.length;t++){f[0]=l[t][0]+d[0],f[1]=l[t][1]+d[1],f[2]=l[t][2]+d[2];let r=Y(l[e],f);r>1e-6&&r<=s&&n.push({d:r,el:i.basis[t].el})}}n.sort((e,t)=>e.d-t.d);let r=n[0].d,o=t??r*1.13,p=n.filter(e=>e.d<=o+1e-6),m=n.find(e=>e.d>o+1e-6);u.push({minPm:r,shellPm:p.map(e=>e.d),shellEl:p.map(e=>e.el),gapRatio:m?m.d/p[p.length-1].d:1/0})}return Pt.set(n,u),u}function It(e,t,n={}){let r=K(e),[i,a,o]=t;for(let e of t)if(!Number.isInteger(e)||e<1)throw Error(`[lattice] число ячеек должно быть целым ≥ 1, получено ${t.join(`×`)}`);let s=n.includeBoundary??!0,c=q(e),l=Ft(e,n.cutoffPm),u=[],d=[],f=s?-1:0;for(let e=0;e<r.basis.length;e++){let t=r.basis[e];for(let n=f;n<=i;n++){let r=t.frac[0]+n;if(Rt(r,i,s))for(let n=f;n<=a;n++){let i=t.frac[1]+n;if(Rt(i,a,s))for(let n=f;n<=o;n++){let a=t.frac[2]+n;if(!Rt(a,o,s))continue;let f=[r,i,a];d.push(J(c,f)),u.push({el:t.el,charge:t.charge??0,posScene:[0,0,0],frac:f,cn:l[e].shellPm.length,basisIndex:e})}}}}let p=J(c,[i/2,a/2,o/2]),m=n.center??!0?[-A(p[0]),-A(p[1]),-A(p[2])]:[0,0,0];for(let e=0;e<u.length;e++){let t=d[e],n=u[e].posScene;n[0]=A(t[0])+m[0],n[1]=A(t[1])+m[1],n[2]=A(t[2])+m[2]}let h=[];for(let e=0;e<u.length;e++){let t=n.cutoffPm??l[u[e].basisIndex].minPm*1.13;for(let r=e+1;r<u.length;r++){let i=n.cutoffPm??l[u[r].basisIndex].minPm*1.13,a=Y(d[e],d[r]);a<=Math.min(t,i)+1e-6&&h.push([e,r,a])}}let g=zt(c,t).map(([e,t])=>[X(e,m),X(t,m)]),_=[1/0,1/0,1/0],v=[-1/0,-1/0,-1/0],y=e=>{for(let t=0;t<3;t++)e[t]<_[t]&&(_[t]=e[t]),e[t]>v[t]&&(v[t]=e[t])};for(let e of u)y(e.posScene);for(let[e,t]of g)y(e),y(t);let b=[(_[0]+v[0])/2,(_[1]+v[1])/2,(_[2]+v[2])/2],x=0;for(let e of u)x=Math.max(x,Y(e.posScene,b));for(let[e,t]of g)x=Math.max(x,Y(e,b),Y(t,b));return{crystalId:e,cells:[i,a,o],sites:u,bonds:h,cellEdges:g,boundsScene:{min:_,max:v,center:b,radius:x},posPm:d,offsetScene:m}}function Lt(e,t,n){let r=K(e),i=q(e),a=It(e,t,{includeBoundary:!1}),o=J(i,[t[0]/2,t[1]/2,t[2]/2]),s=new Set(n.map(e=>e.ligand)),c=[],l=[],u=e=>[A(e[0]),A(e[1]),A(e[2])];return a.sites.forEach((e,t)=>{if(s.has(e.el))return;let d=a.posPm[t],f=[d[0]-o[0],d[1]-o[1],d[2]-o[2]],p=n.find(t=>t.center===e.el),m=c.length,h=[Math.floor(e.frac[0]+G),Math.floor(e.frac[1]+G),Math.floor(e.frac[2]+G)];if(c.push({el:e.el,charge:e.charge,posPm:f,posScene:u(f),role:p?`center`:`ion`,group:p?m:-1,basisIndex:e.basisIndex,cell:h}),!p)return;let g=[],_=[0,0,0];r.basis.forEach((t,n)=>{if(t.el===p.ligand)for(let r=-1;r<=1;r++)for(let a=-1;a<=1;a++)for(let s=-1;s<=1;s++){let c=[Math.floor(e.frac[0]+G),Math.floor(e.frac[1]+G),Math.floor(e.frac[2]+G)];J(i,[t.frac[0]+c[0]+r,t.frac[1]+c[1]+a,t.frac[2]+c[2]+s],_);let l=Y(d,_);g.push({d:l,pos:[_[0]-o[0],_[1]-o[1],_[2]-o[2]],bi:n,charge:t.charge??0})}}),g.sort((e,t)=>e.d-t.d);for(let e of g.slice(0,p.ligands))l.push([m,c.length,e.d]),c.push({el:p.ligand,charge:e.charge,posPm:e.pos,posScene:u(e.pos),role:`ligand`,group:m,basisIndex:e.bi,cell:h})}),{sites:c,bonds:l,cellEdges:Bt(e,t)}}function Rt(e,t,n){return n?e>=-G&&e<=t+G:e>=-G&&e<t-G}function X(e,t){return[A(e[0])+t[0],A(e[1])+t[1],A(e[2])+t[2]]}function zt(e,t){let[n,r,i]=t,a=[];for(let t=0;t<=n;t++)for(let o=0;o<=r;o++)for(let s=0;s<=i;s++){let c=J(e,[t,o,s]);t<n&&a.push([c,J(e,[t+1,o,s])]),o<r&&a.push([c,J(e,[t,o+1,s])]),s<i&&a.push([c,J(e,[t,o,s+1])])}return a}function Bt(e,t,n={}){let r=q(e),i=J(r,[t[0]/2,t[1]/2,t[2]/2]),a=n.center??!0?[-A(i[0]),-A(i[1]),-A(i[2])]:[0,0,0];return zt(r,t).map(([e,t])=>[X(e,a),X(t,a)])}function Vt(e,t){let n=[];for(let[r,i,a]of e.bonds)r===t?n.push({j:i,d:a}):i===t&&n.push({j:r,d:a});n.sort((e,t)=>e.d-t.d||e.j-t.j);let r=n.map(e=>e.j),i=Ut(r.map(t=>e.posPm[t]));return{site:t,neighbors:r,distancesPm:n.map(e=>e.d),edges:i.map(([e,t])=>[r[e],r[t]])}}var Z=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],Ht=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],Q=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],$=e=>Math.hypot(e[0],e[1],e[2]);function Ut(e){let t=e.length;if(t<3)return[];let n=Math.max(...e.map(t=>$(Z(t,e[0]))))||1,r=1e-6*n,i=new Set,a=(e,t)=>i.add(e<t?`${e}|${t}`:`${t}|${e}`),o=null;for(let i=1;i<t&&!o;i++)for(let a=i+1;a<t&&!o;a++){let t=Ht(Z(e[i],e[0]),Z(e[a],e[0]));$(t)>r*n&&(o=t)}if(!o)return[];if(e.every(t=>Math.abs(Q(Z(t,e[0]),o))/$(o)<r))Wt(e,e.map((e,t)=>t),o,a);else{let i=new Set;for(let o=0;o<t;o++)for(let s=o+1;s<t;s++)for(let c=s+1;c<t;c++){let l=Ht(Z(e[s],e[o]),Z(e[c],e[o])),u=$(l);if(u<r*n)continue;let d=0,f=0,p=[];for(let n=0;n<t;n++){let t=Q(Z(e[n],e[o]),l)/u;t>r?d++:t<-r?f++:p.push(n)}if(d>0&&f>0)continue;let m=p.join(`,`);i.has(m)||(i.add(m),Wt(e,p,l,a))}}return[...i].map(e=>e.split(`|`).map(Number))}function Wt(e,t,n,r){if(t.length===3){r(t[0],t[1]),r(t[1],t[2]),r(t[0],t[2]);return}let i=e[t[0]],a=[0,0,0];for(let n of t){let t=Z(e[n],i);if($(t)>1e-9){a=t;break}}let o=$(a);a=[a[0]/o,a[1]/o,a[2]/o];let s=Ht(n,a),c=$(s),l=[s[0]/c,s[1]/c,s[2]/c],u=t.map(t=>({q:t,x:Q(Z(e[t],i),a),y:Q(Z(e[t],i),l)}));u.sort((e,t)=>e.x-t.x||e.y-t.y);let d=(e,t,n)=>(t.x-e.x)*(n.y-e.y)-(t.y-e.y)*(n.x-e.x),f=1e-9*Math.max(1,...u.map(e=>Math.abs(e.x)+Math.abs(e.y))),p=[];for(let e of u){for(;p.length>=2&&d(p[p.length-2],p[p.length-1],e)<=f;)p.pop();p.push(e)}let m=[];for(let e=u.length-1;e>=0;e--){let t=u[e];for(;m.length>=2&&d(m[m.length-2],m[m.length-1],t)<=f;)m.pop();m.push(t)}let h=p.slice(0,-1).concat(m.slice(0,-1));for(let e=0;e<h.length;e++)r(h[e].q,h[(e+1)%h.length].q)}function Gt(e){return(Math.round(e*10)/10).toFixed(1)}function Kt(e){let t=K(e),n=t.setting??`cubic`,r=[`a = ${Gt(t.cellPm.a)} {pm}`];return n===`orthorhombic`&&t.cellPm.b!=null&&r.push(`b = ${Gt(t.cellPm.b)} {pm}`),n!==`cubic`&&t.cellPm.c!=null&&r.push(`c = ${Gt(t.cellPm.c)} {pm}`),r.push(t.spaceGroup),r.push(`{cn} ${Object.values(t.coordination).join(`:`)}`),r}function qt(e){return{capacity:e,seg:new Float32Array(Math.max(1,e)*6),count:0,version:0,amount:0}}function Jt(e,t,n=[0,0,0],r=1){if(t.length>e.capacity)throw Error(`[lattice] рёбер ${t.length} больше ёмкости пула ${e.capacity}`);for(let i=0;i<t.length;i++){let[a,o]=t[i],s=i*6;e.seg[s]=a[0]*r+n[0],e.seg[s+1]=a[1]*r+n[1],e.seg[s+2]=a[2]*r+n[2],e.seg[s+3]=o[0]*r+n[0],e.seg[s+4]=o[1]*r+n[1],e.seg[s+5]=o[2]*r+n[2]}return e.count=t.length,e.version++,e.count}function Yt(e,t){e.amount=t<0?0:t>1?1:t}function Xt(e){let{steps:t,finish:n,cues:r}=e,i=[...t.map(e=>({to:e.to,wall:e.wall,ease:e.ease})),{to:n.to,wall:n.wall,ease:n.ease}];return{steps:t,stepIds:t.map(e=>e.id),finish:n,end:n.to,segments:i,cues:r,wallDuration:_t(i),stepIndexAt(e){for(let n=0;n<t.length;n++)if(e<=t[n].to)return n;return t.length-1},stepById(e){let n=t.find(t=>t.id===e);if(!n)throw Error(`[sceneKit] нет шага «${e}»`);return n},cueAt(e){let t=r.find(t=>t.id===e);if(!t)throw Error(`[sceneKit] нет события «${e}»`);return t.at},validate(){if(t.length===0)throw Error(`[sceneKit] у сцены нет шагов`);let e=0;for(let n of t){if(n.from!==e)throw Error(`[sceneKit] шаг «${n.id}»: from=${n.from}, ожидалось ${e}`);if(n.to<=n.from)throw Error(`[sceneKit] шаг «${n.id}»: to (${n.to}) ≤ from (${n.from})`);if(n.wall<=0)throw Error(`[sceneKit] шаг «${n.id}»: wall должен быть > 0`);e=n.to}if(n.from!==e)throw Error(`[sceneKit] хвост начинается с ${n.from}, а шаги кончились на ${e}`);if(n.to<=n.from)throw Error(`[sceneKit] хвост сцены пустой`);let i=-1/0;for(let e of r){if(e.at<0||e.at>n.to)throw Error(`[sceneKit] событие «${e.id}» (${e.at}) вне [0, ${n.to}]`);if(e.at<i)throw Error(`[sceneKit] события должны идти по возрастанию: «${e.id}» после ${i}`);i=e.at}let a=e=>r.findIndex(t=>t.id===e),o=a(`embryo`),s=a(`birth`),c=a(`complete`);if(o<0||s<0||c<0)throw Error(`[sceneKit] контракт лаборатории: нужны события embryo, birth и complete`);if(!(o<s&&s<c))throw Error(`[sceneKit] порядок обязан быть embryo → birth → complete`)}}}function Zt(e){let t={},n={};for(let r of e.glows){let e=ft();t[r.id]=e,n[r.id]={current:e}}let r={};for(let t of e.waves??[])r[t.id]=dt(t.color,t.radius??1.2);return{atoms:ae(e.atoms),bonds:oe(e.bonds),lobes:se(e.lobes??24),...e.edges?{edges:qt(e.edges)}:{},rig:pt(),post:{current:ht()},glows:t,glowRefs:n,glowSpecs:e.glows,waves:r,puff:ut(e.puffColor??16754776,e.puffSpread??1.1),safe:nt(),visualTime:{current:0}}}function Qt(e,t,n,r){let i=e.glows[t];i&&(i.center.copy(n),i.amount=r)}function $t(e,t,n,r){let i=e.waves[t];i&&(i.center.copy(n),i.amount=r)}function en(e,t,n,r){let i=e.puff;i.center.copy(t),i.opacity=n,r?.spread!==void 0&&(i.spread=r.spread),r?.rise!==void 0&&(i.rise=r.rise),r?.turbulence!==void 0&&(i.turbulence=r.turbulence)}function tn(e){let[t]=(0,v.useState)(e);return t}function nn(){return{zoom:1,offset:new i,yaw:0,pitch:0,roll:0,shake:0,bloom:.3,vignette:.3}}function rn(e,t,n,r,i=`inOutSine`){return[{t:e,v:t},{t:n,v:r,ease:i}]}function an(e){return rn(e.from,0,e.to,1,`inQuad`)}function on(e,t=.55){return rn(e,0,e+t,1,`smooth`)}function sn(e){return e.map(e=>({id:e.id,kind:e.kind,pos:new i,opacity:0,text:e.keys[0].text}))}function cn(e,t){let n=e.keys[0].text;for(let r of e.keys)t>=r.t&&(n=r.text);return n}function ln(e,t,n=.25){let r=0;for(let i of e.windows)r=Math.max(r,At(i,t,n));return r}function un(e,t,n,r,i=0){for(let a=0;a<e.length;a++){let o=e[a],s=t[a];s.text=cn(o,n),r(o,s),s.opacity=ln(o,n)*(1-i)}}var dn={ru:{s:`тв.`,g:`г.`,l:`ж.`,aq:`р-р`,pm:`пм`,nm:`нм`,kJmol:`кДж/моль`,kJ:`кДж`,cn:`КЧ`,gcm3:`г/см³`},en:{s:`s`,g:`g`,l:`l`,aq:`aq`,pm:`pm`,nm:`nm`,kJmol:`kJ/mol`,kJ:`kJ`,cn:`CN`,gcm3:`g/cm³`},uz:{s:`qat.`,g:`gaz`,l:`suyuq.`,aq:`eritma`,pm:`pm`,nm:`nm`,kJmol:`kJ/mol`,kJ:`kJ`,cn:`KS`,gcm3:`g/sm³`}};function fn(e){return e===`en`?`en`:e===`uz`?`uz`:`ru`}var pn=/\{(\w+)\}/g,mn={ru:new Map,en:new Map,uz:new Map};function hn(e,t,n=!1){let r=n&&t!==`en`;if(!r&&e.indexOf(`{`)<0)return e;let i=(r?gn:mn)[t]??mn.ru,a=i.get(e);if(a!==void 0)return a;let o=dn[t],s=e.indexOf(`{`)<0?e:e.replace(pn,(e,t)=>o[t]??e);return r&&(s=s.replace(_n,`$1,$2`)),i.set(e,s),s}var gn={ru:new Map,en:new Map,uz:new Map},_n=/(\d)\.(\d)/g;function vn(e,t,n=!1){for(let r=0;r<e.length;r++){let i=e[r];i.text=hn(i.text,t,n)}}function yn(e){for(let[t,n]of Object.entries(e))Mt(t,n)}export{We as $,yt as A,dt as B,Jt as C,y as Ct,At as D,kt as E,mt as F,st as G,lt as H,pt as I,$e as J,it as K,ft as L,bt as M,gt as N,B as O,_t as P,Xe as Q,ht as R,Yt as S,ee as St,Ot as T,x as Tt,nt as U,rt as V,F as W,Be as X,Ve as Y,Ge as Z,q as _,T as _t,Xt as a,Ye as at,It as b,ne as bt,vn as c,Ie as ct,Qt as d,ye as dt,A as et,en as f,Ce as ft,yn as g,se as gt,tn as h,oe as ht,nn as i,Je as it,V as j,vt as k,rn as l,Pe as lt,fn as m,ae as mt,Zt as n,Ue as nt,an as o,Le as ot,$t as p,ie as pt,et as q,sn as r,He as rt,hn as s,Ne as st,on as t,qe as tt,un as u,ve as ut,Vt as v,E as vt,jt as w,b as wt,Lt as x,te as xt,Kt as y,re as yt,ut as z};