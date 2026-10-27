/* 電翼動力 EWP — 靈雀外場電包 4S3P 組裝動畫（WebGL 即時渲染）
 * 由 build.mjs 輸出的 [data-pack-anim] 區塊啟動。
 * 效能：捲動到附近才建立 WebGL、離開畫面或分頁隱藏就停止繪製、依實際幀率自動降解析度。
 * 降級：沒有 WebGL 只顯示靜態圖；偏好減少動態或開啟省流量時，先顯示靜態圖，按「播放」才啟動。 */
(function () {
  'use strict';
  var FS = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 uRes; uniform float uT; uniform float uClock; uniform sampler2D uLabel; uniform sampler2D uSide; uniform float uDisp; uniform vec3 uRed;\nfloat sat(float x){return clamp(x,0.,1.);}\nfloat ease(float x){x=sat(x);return 1.-pow(1.-x,3.);}\nfloat ease2(float x){x=sat(x);return x*x*(3.-2.*x);}\nfloat hash(float n){return fract(sin(n)*43758.5453);}\nmat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}\nfloat sdCyl(vec3 p,float r,float h){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h);return min(max(d.x,d.y),0.)+length(max(d,0.));}\nfloat sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}\nfloat sdRBox(vec3 p,vec3 b,float r){return sdBox(p,b-r)-r;}\nfloat sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=sat(dot(pa,ba)/max(dot(ba,ba),1e-4));return length(pa-ba*h)-r;}\nvec2 opU(vec2 a,vec2 b){return a.x<b.x?a:b;}\nfloat fillLevel(float t){return mix(-4.6,4.7,ease2((t-10.0)/2.6));}\nvec3 gridPos(float fi){float iz=floor((fi+.5)/4.);float ix=fi-4.*iz;return vec3((ix-1.5)*2.2,0.,(iz-1.)*2.2);}\nvec3 cellPos(float fi,float t,out float vis,out float tilt){\nvec3 g=gridPos(fi); tilt=0.;\nif(fi>4.5&&fi<5.5){float k=ease((t-3.0)/1.4);vis=1.;tilt=(1.-k)*.38;return mix(vec3(0.),g,k);}\nfloat r=fi*7.;r=r-12.*floor((r+.5)/12.);\nfloat k=ease((t-(3.3+r*.09))/1.0);\nvis=step(.001,k);\nvec3 dir=normalize(vec3(g.x+.01,0.,g.z+.013));\nreturn mix(g+dir*16.+vec3(0.,9.,0.),g,k);\n}\nvec2 map(vec3 p){\nfloat t=uT;\nvec2 res=vec2(p.y+4.3,0.);\nif(t<13.0){\nfloat bb=sdBox(p,vec3(5.0,4.2,3.9));\nif(t>5.4&&bb>.5){res=opU(res,vec2(bb,1.));}\nelse{\nfor(int i=0;i<12;i++){\nfloat fi=float(i);float vis,tilt;vec3 c=cellPos(fi,t,vis,tilt);\nif(vis<.5)continue;\nvec3 q=p-c;q.xy=rot(tilt)*q.xy;\nfloat iz=floor((fi+.5)/4.);float ix=fi-4.*iz;\nfloat par=ix-2.*floor((ix+.5)/2.);\nq.y*=(par<.5?1.:-1.);\nfloat body=sdCyl(q,1.0,3.45)-.05;\nfloat nub=sdCyl(q-vec3(0.,3.55,0.),.4,.07)-.02;\nfloat d=min(body,nub);\nif(d<res.x){float r=length(q.xz);float m=(nub<body||(abs(q.y)>3.42&&r<.86))?2.:1.;res=vec2(d,m);}\n}\n}\n}\nif(t>6.8&&t<13.0){\nfor(int j=0;j<5;j++){\nfloat fj=float(j);vec3 c;float hx;\nif(j==0){c=vec3(-3.3,3.70,0.);hx=.55;}\nelse if(j==1){c=vec3(0.,3.70,0.);hx=1.65;}\nelse if(j==2){c=vec3(3.3,3.70,0.);hx=.55;}\nelse if(j==3){c=vec3(-2.2,-3.70,0.);hx=1.65;}\nelse{c=vec3(2.2,-3.70,0.);hx=1.65;}\nfloat k=ease((t-6.9-mod(fj,3.)*.18)/.7);\nif(k<.01)continue;\nvec3 q=p-c;q.y-=(1.-k)*3.*sign(c.y);\nfloat d=sdBox(q,vec3(hx,.03,2.65*k+.01))-.01;\nfloat slot=sdBox(vec3(q.x,q.y,abs(q.z)-1.1),vec3(max(hx-.38,.01),.1,.13));\nd=max(d,-slot);\nif(d<res.x)res=vec2(d,3.);\n}\n}\nif(t>10.0){\nfloat puff=1.+.07*(1.-ease((t-10.2)/2.6));\nfloat d=sdRBox(p,vec3(4.5,3.9,3.4)*puff,.38);\nd=max(d,p.y-fillLevel(t));\nif(d<res.x)res=vec2(d,4.);\n}\nif(t>12.3){\nfloat k=ease((t-12.3)/1.1);\nvec3 hp=p-vec3(-.3,3.75-(1.-k)*3.4,0.);\nfloat hd=hp.y>=0.?length(vec2(length(hp.xy)-2.7,hp.z))-.24:length(hp-vec3(sign(hp.x)*2.7,0.,0.))-.24;\nres=opU(res,vec2(hd,9.));\nfloat kl=ease((t-12.7)/1.0);\nif(kl>.01){\nvec3 a=vec3(3.9,3.0,1.2),b=vec3(5.2,3.9,1.2),c=vec3(6.5,3.65,1.2);\nfloat dl=sdCap(p,a,mix(a,b,sat(kl*2.)),.17);\nif(kl>.5)dl=min(dl,sdCap(p,b,mix(b,c,(kl-.5)*2.),.17));\nres=opU(res,vec2(dl,9.));\nvec3 a2=vec3(3.9,2.4,.3),b2=vec3(5.0,3.0,.1),c2=vec3(5.9,2.7,.1);\nfloat d2=sdCap(p,a2,mix(a2,b2,sat(kl*2.)),.06);\nif(kl>.5)d2=min(d2,sdCap(p,b2,mix(b2,c2,(kl-.5)*2.),.06));\nres=opU(res,vec2(d2,6.));\n}\nfloat kx=ease((t-13.5)/.5);\nif(kx>.01){\nres=opU(res,vec2(sdRBox(p-vec3(6.95,3.65,1.2),vec3(.45,.3,.25)*kx,.07*kx),7.));\nres=opU(res,vec2(sdBox(p-vec3(7.5,3.65,1.2),vec3(.14,.11,.11)*kx),2.));\nres=opU(res,vec2(sdRBox(p-vec3(6.15,2.7,.1),vec3(.26,.12,.14)*kx,.03),8.));\n}\n}\nreturn res;\n}\nvec3 calcN(vec3 p){vec2 e=vec2(.002,-.002);\nreturn normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}\nfloat ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<=3;i++){float h=.15*float(i);o+=(h-map(p+n*h).x)*s;s*=.6;}return sat(1.-1.5*o);}\nvec3 env(vec3 r){\nvec3 e=mix(vec3(.012,.014,.02),vec3(.14,.15,.17),sat(r.y*.6+.4));\ne+=vec3(1.)*smoothstep(.93,.995,dot(r,normalize(vec3(.4,.75,.55))))*2.2;\ne+=uRed*smoothstep(.84,.98,dot(r,normalize(vec3(-1.,.15,-.3))))*1.8;\ne+=vec3(.9,.8,.6)*smoothstep(.95,1.,dot(r,normalize(vec3(.9,.2,-.6))))*1.2;\nreturn e;\n}\nvec3 film(float c){return .5+.5*cos(6.2831*(vec3(0.,.33,.67)+c*1.8+.15));}\nvec3 shade(vec3 p,vec3 rd,vec3 n,float m,float t){\nvec3 L=normalize(vec3(.5,.85,.45));\nfloat dif=sat(dot(n,L));\nfloat nv=sat(dot(n,-rd));\nfloat fre=pow(1.-nv,5.);\nvec3 r=reflect(rd,n);\nfloat a=ao(p,n);\nvec3 col;\nif(m<.5){\nfloat sh=.3+.7*sat(map(p+vec3(0.,1.2,0.)).x/1.2);\ncol=vec3(.010,.011,.014)*sh;\nvec2 g=abs(fract(p.xz/1.1+.5)-.5)*1.1;\nfloat gl=max(smoothstep(.025,.0,g.x),smoothstep(.025,.0,g.y));\nfloat fade=exp(-length(p.xz)*.07);\ncol+=vec3(.05,.055,.065)*gl*fade*sh;\ncol+=uRed*exp(-abs(length(p.xz)-7.5)*10.)*.25*fade;\n}else if(m<1.5){\nvec3 base=vec3(.035,.05,.075);\ncol=base*(.2+dif*.9)*a+env(r)*(.03+.5*fre)+film(nv)*fre*.8*a;\ncol+=pow(sat(dot(r,L)),80.)*.9;\n}else if(m<2.5){\ncol=env(r)*vec3(.72,.73,.75)*(.45+.55*a)+dif*.05;\n}else if(m<3.5){\ncol=env(r)*vec3(.80,.77,.70)*(.4+.6*a)+vec3(.30,.29,.26)*dif*a+pow(sat(dot(r,L)),60.)*.6;\nfloat ix=clamp(floor((p.x+4.4)/2.2),0.,3.),iz=clamp(floor((p.z+3.3)/2.2),0.,2.);\nvec2 cc=vec2((ix-1.5)*2.2,(iz-1.)*2.2);\nfloat tf=7.8+(ix+4.*iz)*.17;\nvec2 q=abs(p.xz-cc);\nfloat dd=min(length(q-vec2(.3,0.)),length(q-vec2(0.,.3)));\nfloat mark=step(tf,t)*step(0.,p.y)*(1.-smoothstep(.05,.08,dd));\nfloat heat=step(tf,t)*step(0.,p.y)*exp(-dd*9.)*.6;\ncol=mix(col,col*.25,mark)+vec3(.25,.12,.35)*heat*.3;\n}else if(m<4.5){\nfloat wr=.5+.5*sin(p.x*5.3+sin(p.y*3.7+p.z*2.)*2.);\ncol=vec3(.010,.010,.011)*(.2+dif)*a+env(r)*(.04+.45*fre)*a+pow(sat(dot(r,L)),50.)*.4*(.6+.4*wr);\nif(n.z>.9&&p.z>3.0&&abs(p.x)<4.1&&p.y>-3.4&&p.y<2.73){\nvec2 uv=vec2((p.x+4.1)/8.2,(p.y+3.4)/6.13);\nvec4 lb=texture2D(uLabel,uv);\nvec3 lc=pow(lb.rgb,vec3(2.2));\ncol=mix(col,lc*(.35+dif*.8)*a+pow(sat(dot(r,L)),50.)*.25,lb.a);\n}\nif(n.x>.9&&p.x>4.0&&abs(p.z)<3.0&&abs(p.y)<2.6){\nvec2 uv=vec2(-p.z/6.0+.5,p.y/5.2+.5);\nvec4 sb=texture2D(uSide,uv);\nvec3 sc=pow(sb.rgb,vec3(2.2));\nfloat glow=step(sb.r*1.8,sb.g)*step(.3,sb.g);\ncol=mix(col,sc*(.3+dif*.8)*a*(1.-glow),sb.a)+sc*glow*uDisp*2.2;\n}\nfloat e=exp(-abs(p.y-fillLevel(t))*16.)*(1.-ease((t-12.4)/.5));\ncol+=uRed*e*3.+vec3(1.,.7,.4)*e*e*1.5;\n}else if(m<5.5){\ncol=uRed*.8*(.12+dif)*a+pow(sat(dot(r,L)),30.)*.35+env(r)*fre*.2;\n}else if(m<6.5){\ncol=vec3(.012)*(.2+dif)*a+pow(sat(dot(r,L)),30.)*.3+env(r)*fre*.25;\n}else if(m<7.5){\ncol=vec3(.36,.27,.04)*(.14+dif)*a+pow(sat(dot(r,L)),40.)*.3;\n}else if(m<8.5){\ncol=vec3(.55,.55,.52)*(.15+dif)*a+pow(sat(dot(r,L)),40.)*.2;\n}else{\nfloat wv=.5+.5*sin(p.x*38.+p.y*38.)*sin(p.x*38.-p.y*38.+p.z*30.);\ncol=vec3(.022)*(.2+dif)*a*(.6+.6*wv)+pow(sat(dot(r,L)),24.)*.3*wv+env(r)*fre*.15;\n}\nreturn col;\n}\nvoid main(){\nfloat t=uT;\nvec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;\nfloat gch=0.;\nfor(int b=0;b<4;b++){float tb=b==0?3.0:(b==1?6.8:(b==2?10.0:12.8));gch+=exp(-pow((t-tb)*9.,2.));}\nfloat row=floor(uv.y*28.)+floor(uClock*24.);\nuv.x+=gch*.035*(step(.72,hash(row))-.5);\nfloat kA=ease2((t-2.8)/1.8),kW=ease2((t-9.8)/2.0),kF=ease2((t-12.6)/2.0);\nfloat dist=mix(15.,28.,kA);dist=mix(dist,34.,kF);\nfloat pitch=mix(.12,.62,kA);pitch=mix(pitch,.30,kW);pitch=mix(pitch,.26,kF);\nfloat yaw=-.75+t*.085;\nvec3 tgt=vec3(0.,mix(0.,.5,kA),0.);tgt.y=mix(tgt.y,1.4,kF);\nvec3 ro=tgt+dist*vec3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch));\nvec3 fw=normalize(tgt-ro),rt=normalize(cross(fw,vec3(0.,1.,0.))),up=cross(rt,fw);\nvec2 suv=uv+vec2(0.,mix(.07,.03,kF));\nvec3 rd=normalize(suv.x*rt+suv.y*up+1.15*fw);\nvec3 bgc=vec3(.010,.011,.015)+uRed*.035*exp(-abs(rd.y+.05)*9.);\nvec3 col=bgc;\nfloat tt=0.,m=-1.;\nfor(int i=0;i<110;i++){\nvec2 h=map(ro+rd*tt);\nif(h.x<.0012*tt){m=h.y;break;}\ntt+=h.x*.9;\nif(tt>80.)break;\n}\nif(m>-.5){\nvec3 p=ro+rd*tt;vec3 n=calcN(p);\ncol=shade(p,rd,n,m,t);\ncol=mix(col,bgc,1.-exp(-.00035*tt*tt));\n}\nif(t>7.6&&t<10.6){\nfor(int i=0;i<12;i++){\nfloat fi=float(i);\nfloat tf=7.8+fi*.17;float dt=t-tf;\nif(dt<-.06||dt>.9)continue;\nvec3 wp=gridPos(fi)+vec3(0.,3.76,0.);\nfloat I=exp(-dt*dt*500.)*2.4+step(0.,dt)*exp(-dt*5.)*.35;\nvec3 w=wp-ro;float tp=dot(w,rd);\nif(tp>0.){\nfloat occ=(m>-.5&&tp>tt+.6)?.12:1.;\nfloat dd=length(w-rd*tp);\ncol+=(vec3(1.,.9,.8)*.004/(dd*dd+.0005)+vec3(1.,.45,.15)*.025/(dd+.06))*I*occ;\n}\nif(dt>0.&&dt<.6){\nfor(int s=0;s<7;s++){\nfloat fs=float(s)+fi*7.;\nvec3 dir=normalize(vec3(hash(fs)-.5,.6+hash(fs+3.1)*.8,hash(fs+7.7)-.5));\nvec3 sp=wp+dir*(2.6+hash(fs+1.3)*2.)*dt-vec3(0.,7.*dt*dt,0.);\nvec3 sw=sp-ro;float sp2=dot(sw,rd);if(sp2<0.)continue;\nfloat sd=length(sw-rd*sp2);\ncol+=vec3(1.,.6,.25)*.0009/(sd*sd+.0002)*(1.-dt/.6);\n}\n}\n}\n}\ncol=1.-exp(-col*1.4);\ncol=pow(col,vec3(1./2.2));\nvec2 v=uv*vec2(1.6,1.);col*=1.-.35*dot(v,v);\ncol+=(hash(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+fract(uClock))-.5)*.018;\ncol+=gch*.06*vec3(step(.85,hash(row+1.)),0.,step(.85,hash(row+2.)));\ngl_FragColor=vec4(col,1.);\n}";
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // 實際播放時間 → 動畫內部時間（各段節奏不同，總長 11.5 秒）
  var KR = [0, 1.6, 4.0, 6.4, 8.2, 11.5], KT = [0, 3.0, 6.8, 10.0, 12.8, 18], TR = 11.5, T = 18;
  var STAGES = [
    { t: 0, title: '21700 CELL', zh: '鋰離子電芯', sub: 'LI-ION · CYLINDRICAL', meta: 'Ø21 × 70 MM · 5000 MAH · 15A' },
    { t: 3.0, title: '4S3P MATRIX', zh: '串並聯排列', sub: '12 CELLS · 4 SERIES × 3 PARALLEL', meta: 'CELL PITCH 22 MM · 正負極交錯' },
    { t: 6.8, title: 'SPOT WELD', zh: '點焊連接', sub: 'COPPER + NICKEL-PLATED STEEL', meta: '紫銅＋鍍鎳鋼點焊' },
    { t: 10.0, title: 'HEAT WRAP', zh: '熱縮封裝', sub: 'HEAT SHRINK', meta: '熱縮包覆 · 外出提把' },
    { t: 12.8, title: 'SPIRIT SPARROW', zh: '靈雀 外場電包', sub: '15000 MAH · 4S3P · 21700', meta: 'XT60 母頭輸出 · 電量顯示' }
  ];
  function warp(r, a, b) {
    for (var i = 1; i < a.length; i++) if (r <= a[i]) { var k = (r - a[i - 1]) / (a[i] - a[i - 1]); return b[i - 1] + k * (b[i] - b[i - 1]); }
    return b[b.length - 1];
  }
  function ease(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.decoding = 'async'; i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }

  function hudHtml(logo) {
    return '<div class="pa-hud" aria-hidden="true">' +
      '<div><div class="pa-row"><span class="pa-idx"><b data-h="idx">01</b> / 05</span><span>EWP · FPV LAB</span></div>' +
      '<div class="pa-prog"><i data-h="prog"></i></div>' +
      '<div class="pa-swap" data-h="swap"><div class="pa-title" data-h="title"></div><div class="pa-zh" data-h="zh"></div><div class="pa-sub" data-h="sub"></div></div>' +
      '<div class="pa-ruler"></div>' +
      '<div class="pa-meta"><span data-h="meta"></span><span class="pa-live" data-h="live"></span></div></div>' +
      '<div class="pa-bottom">' +
      '<div class="pa-specs" data-h="specs">' +
      '<div><span>標稱</span><strong>14.8<small>V</small></strong></div>' +
      '<div><span>滿電</span><strong>16.8<small>V</small></strong></div>' +
      '<div><span>容量</span><strong>15000<small>mAh</small></strong></div>' +
      '<div><span>能量</span><strong>222<small>Wh</small></strong></div></div>' +
      '<div class="pa-formula"><div data-h="f1">V = 4S × 3.7 V = <em>14.8 V</em></div><div data-h="f2">C = 3P × 5000 mAh = <em>15000 mAh</em></div></div>' +
      '<div class="pa-hazard"></div>' +
      '<div class="pa-foot"><img src="' + logo + '" alt="" width="58" height="21"><span>READY TO FLY</span><span class="pa-foot-r">21700 · 4S3P</span></div>' +
      '</div></div><div class="pa-fade" data-h="fade"></div>';
  }

  function frontTexture(img) {
    var c = document.createElement('canvas'); c.width = 1000; c.height = 748;
    // 商品圖 04 為貼標原稿，置中於 1000×1000，有效區 y 125–873
    c.getContext('2d').drawImage(img, 0, 125, 1000, 748, 0, 0, 1000, 748);
    return c;
  }
  function sideTexture(logo) {
    var c = document.createElement('canvas'); c.width = 600; c.height = 520; var x = c.getContext('2d');
    if (logo) x.drawImage(logo, 90, 40, 420, 152);
    x.fillStyle = '#050606'; x.fillRect(150, 270, 300, 150);
    x.strokeStyle = '#2a2d30'; x.lineWidth = 6; x.strokeRect(150, 270, 300, 150);
    x.fillStyle = '#3cff7a'; x.font = '700 104px ui-monospace, Menlo, Consolas, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('16.8', 300, 348);
    return c;
  }

  function create(root) {
    var stage = root.querySelector('.pa-stage');
    var logoSrc = root.getAttribute('data-logo'), frontSrc = root.getAttribute('data-front');
    var cv = document.createElement('canvas'); cv.className = 'pa-canvas';
    var gl = null;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var prog = gl.createProgram();
    try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); } catch (e) { if (window.console) console.warn('pack-anim', e); return null; }
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    function U(n) { return gl.getUniformLocation(prog, n); }
    var uRes = U('uRes'), uT = U('uT'), uClock = U('uClock'), uDisp = U('uDisp');
    gl.uniform3f(U('uRed'), 1.0, 0.068, 0.046);
    function tex(unit) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    var tFront = tex(0), tSide = tex(1);
    gl.uniform1i(U('uLabel'), 0); gl.uniform1i(U('uSide'), 1);
    var texVer = 0;
    function upload(unit, t, src) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); texVer++; drawOnce();
    }
    var logoImg = null;
    loadImg(logoSrc).then(function (i) { logoImg = i; upload(1, tSide, sideTexture(i)); }, function () { upload(1, tSide, sideTexture(null)); });
    if (frontSrc) loadImg(frontSrc).then(function (i) { upload(0, tFront, frontTexture(i)); }, function () {});

    stage.insertBefore(cv, stage.firstChild);
    stage.insertAdjacentHTML('beforeend', hudHtml(logoSrc));
    var h = {}; Array.prototype.forEach.call(stage.querySelectorAll('[data-h]'), function (el) { h[el.getAttribute('data-h')] = el; });
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-pa-step]'));

    var maxScale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8, scale = maxScale, W = 2, H = 2;
    function resize() {
      W = Math.max(2, Math.round(stage.clientWidth * scale)); H = Math.max(2, Math.round(stage.clientHeight * scale));
      cv.width = W; cv.height = H; gl.viewport(0, 0, W, H); drawOnce();
    }
    var tau = 0, t = 0, cur = -1, playing = false, running = false, last = 0, frames = 0, acc = 0, lastKey = '';
    function setStage(i) {
      cur = i; var s = STAGES[i];
      h.idx.textContent = pad(i + 1); h.title.textContent = s.title; h.zh.textContent = s.zh; h.sub.textContent = s.sub; h.meta.textContent = s.meta;
      h.title.classList.toggle('pa-long', s.title.length > 12);
      h.swap.classList.remove('go'); void h.swap.offsetWidth; h.swap.classList.add('go');
      steps.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
    }
    function hud() {
      var i = 0; for (var k = 0; k < STAGES.length; k++) if (t >= STAGES[k].t) i = k;
      if (i !== cur) setStage(i);
      h.prog.style.width = (tau / TR * 100).toFixed(2) + '%';
      var live = 'FIG.01', n;
      if (i === 1) { n = t > 4.4 ? 1 : 0; for (var c = 0; c < 12; c++) { if (c === 5) continue; if (t > 3.3 + ((c * 7) % 12) * 0.09 + 0.85) n++; } live = 'CELLS ' + pad(n) + '/12'; }
      else if (i === 2) { n = Math.max(0, Math.min(12, Math.floor((t - 7.8) / 0.17) + 1)); live = 'WELD ' + pad(n) + '/12'; }
      else if (i === 3) { live = 'WRAP ' + Math.round(ease((t - 10) / 2.6) * 100) + '%'; }
      else if (i === 4) { live = 'READY'; }
      h.live.textContent = live;
      h.f1.classList.toggle('on', t > 3.8 && t < 12.8);
      h.f2.classList.toggle('on', t > 4.4 && t < 12.8);
      h.specs.classList.toggle('on', t > 13.6);
      h.fade.style.opacity = Math.max(0, 1 - t / 0.45, (t - (T - 0.6)) / 0.6).toFixed(3);
    }
    function draw(now) {
      var key = t + '|' + W + '|' + H + '|' + texVer;
      if (key === lastKey && !playing) return;
      gl.uniform2f(uRes, W, H); gl.uniform1f(uT, t); gl.uniform1f(uClock, (now || performance.now()) / 1000);
      gl.uniform1f(uDisp, ease((t - 14.0) / 0.4));
      gl.drawArrays(gl.TRIANGLES, 0, 3); lastKey = key;
      hud();
      if (!root.classList.contains('pa-live')) root.classList.add('pa-live');
    }
    function drawOnce() { if (!running) draw(); }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      tau += dt; if (tau >= TR) { tau -= TR; cur = -1; }
      t = warp(tau, KR, KT);
      draw(now);
      acc += dt; frames++;
      if (frames >= 45) {
        var avg = acc / frames;
        if (avg > 0.034 && scale > 0.4) { scale *= 0.85; resize(); }
        else if (avg < 0.018 && scale < maxScale) { scale = Math.min(maxScale, scale * 1.1); resize(); }
        frames = 0; acc = 0;
      }
      requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }
    var ctl = {
      play: function () { playing = true; root.classList.remove('pa-paused'); start(); sync(); },
      pause: function () { playing = false; stop(); root.classList.add('pa-paused'); sync(); drawOnce(); },
      isPlaying: function () { return playing; },
      seek: function (internalT) { t = internalT; tau = warp(internalT, KT, KR); cur = -1; lastKey = ''; drawOnce(); },
      seekStage: function (i) { ctl.seek(STAGES[i].t + 0.02); },
      suspend: stop,
      resume: function () { if (playing) start(); }
    };
    var toggle = root.querySelector('[data-pa-toggle]');
    function sync() { if (toggle) { toggle.textContent = playing ? '暫停動畫' : '播放動畫'; toggle.setAttribute('aria-pressed', String(!playing)); } }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
    resize();
    return ctl;
  }

  function mount(root) {
    var stage = root.querySelector('.pa-stage');
    if (!stage) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    var auto = !(reduce || saveData);
    var ctl = null, failed = false, inView = false;
    var playBtn = root.querySelector('[data-pa-play]'), toggle = root.querySelector('[data-pa-toggle]');
    function ensure() {
      if (ctl || failed) return ctl;
      ctl = create(root);
      if (!ctl) { failed = true; root.classList.add('pa-static'); return null; }
      root.packAnim = ctl;
      return ctl;
    }
    function begin() { if (ensure()) { ctl.play(); if (!inView) ctl.suspend(); } }
    if (!auto) root.classList.add('pa-manual');
    if (playBtn) playBtn.addEventListener('click', function () { root.classList.remove('pa-manual'); begin(); });
    if (toggle) toggle.addEventListener('click', function () { if (!ensure()) return; root.classList.remove('pa-manual'); ctl.isPlaying() ? ctl.pause() : ctl.play(); });
    stage.addEventListener('click', function (e) { if (e.target.closest('[data-pa-play]') || !ctl) return; ctl.isPlaying() ? ctl.pause() : ctl.play(); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-pa-step]'), function (el, i) {
      el.addEventListener('click', function () { if (!ensure()) return; root.classList.remove('pa-manual'); ctl.seekStage(i); ctl.play(); });
    });
    var near = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { near = e.isIntersecting; if (near && auto && !ctl && !failed) begin(); }); }, { rootMargin: '300px 0px' }).observe(stage);
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { inView = e.isIntersecting; if (!ctl) return; if (inView && !document.hidden) ctl.resume(); else ctl.suspend(); });
      }, { threshold: 0.05 }).observe(stage);
    } else { inView = true; if (auto) begin(); }
    document.addEventListener('visibilitychange', function () { if (!ctl) return; if (document.hidden) ctl.suspend(); else if (inView) ctl.resume(); });
  }

  function init() { Array.prototype.forEach.call(document.querySelectorAll('[data-pack-anim]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
