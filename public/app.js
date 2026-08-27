(()=>{function c(e){let a=new Uint8Array(e),t="";for(let o of a)t+=String.fromCharCode(o);return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}function S(e){let a=e.replace(/-/g,"+").replace(/_/g,"/"),t=(4-a.length%4)%4,r=a.padEnd(a.length+t,"="),o=atob(r),d=new ArrayBuffer(o.length),h=new Uint8Array(d);for(let n=0;n<o.length;n++)h[n]=o.charCodeAt(n);return d}function b(){return he.stubThis(globalThis?.PublicKeyCredential!==void 0&&typeof globalThis.PublicKeyCredential=="function")}var he={stubThis:e=>e};function R(e){let{id:a}=e;return{...e,id:S(a),transports:e.transports}}function M(e){return e==="localhost"||/^((xn--[a-z0-9-]+|[a-z0-9]+(-[a-z0-9]+)*)\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(e)}var p=class extends Error{constructor({message:a,code:t,cause:r,name:o}){super(a,{cause:r}),Object.defineProperty(this,"code",{enumerable:!0,configurable:!0,writable:!0,value:void 0}),this.name=o??r.name,this.code=t}};function fe({error:e,options:a}){let{publicKey:t}=a;if(!t)throw Error("options was missing required publicKey property");if(e.name==="AbortError"){if(a.signal instanceof AbortSignal)return new p({message:"Registration ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:e})}else if(e.name==="ConstraintError"){if(t.authenticatorSelection?.requireResidentKey===!0)return new p({message:"Discoverable credentials were required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",cause:e});if(a.mediation==="conditional"&&t.authenticatorSelection?.userVerification==="required")return new p({message:"User verification was required during automatic registration but it could not be performed",code:"ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",cause:e});if(t.authenticatorSelection?.userVerification==="required")return new p({message:"User verification was required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",cause:e})}else{if(e.name==="InvalidStateError")return new p({message:"The authenticator was previously registered",code:"ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",cause:e});if(e.name==="NotAllowedError")return new p({message:e.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:e});if(e.name==="NotSupportedError")return t.pubKeyCredParams.filter(o=>o.type==="public-key").length===0?new p({message:'No entry in pubKeyCredParams was of type "public-key"',code:"ERROR_MALFORMED_PUBKEYCREDPARAMS",cause:e}):new p({message:"No available authenticator supported any of the specified pubKeyCredParams algorithms",code:"ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",cause:e});if(e.name==="SecurityError"){let r=globalThis.location.hostname;if(M(r)){if(t.rp.id!==r)return new p({message:`The RP ID "${t.rp.id}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:e})}else return new p({message:`${globalThis.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:e})}else if(e.name==="TypeError"){if(t.user.id.byteLength<1||t.user.id.byteLength>64)return new p({message:"User ID was not between 1 and 64 characters",code:"ERROR_INVALID_USER_ID_LENGTH",cause:e})}else if(e.name==="UnknownError")return new p({message:"The authenticator was unable to process the specified options, or could not create a new credential",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:e})}return e}var I=class{constructor(){Object.defineProperty(this,"controller",{enumerable:!0,configurable:!0,writable:!0,value:void 0})}createNewAbortSignal(){if(this.controller){let t=new Error("Cancelling existing WebAuthn API call for new one");t.name="AbortError",this.controller.abort(t)}let a=new AbortController;return this.controller=a,a.signal}cancelCeremony(){if(this.controller){let a=new Error("Manually cancelling existing WebAuthn API call");a.name="AbortError",this.controller.abort(a),this.controller=void 0}}},T=new I;var ge=["cross-platform","platform"];function D(e){if(e&&!(ge.indexOf(e)<0))return e}async function se(e){!e.optionsJSON&&e.challenge&&(console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."),e={optionsJSON:e});let{optionsJSON:a,useAutoRegister:t=!1}=e;if(!b())throw new Error("WebAuthn is not supported in this browser");let r={...a,challenge:S(a.challenge),user:{...a.user,id:S(a.user.id)},excludeCredentials:a.excludeCredentials?.map(R)},o={};t&&(o.mediation="conditional"),o.publicKey=r,o.signal=T.createNewAbortSignal();let d;try{d=await navigator.credentials.create(o)}catch(g){throw fe({error:g,options:o})}if(!d)throw new Error("Registration was not completed");let{id:h,rawId:n,response:x,type:H}=d,w;typeof x.getTransports=="function"&&(w=x.getTransports());let k;if(typeof x.getPublicKeyAlgorithm=="function")try{k=x.getPublicKeyAlgorithm()}catch(g){$("getPublicKeyAlgorithm()",g)}let P;if(typeof x.getPublicKey=="function")try{let g=x.getPublicKey();g!==null&&(P=c(g))}catch(g){$("getPublicKey()",g)}let v;if(typeof x.getAuthenticatorData=="function")try{v=c(x.getAuthenticatorData())}catch(g){$("getAuthenticatorData()",g)}return{id:h,rawId:c(n),response:{attestationObject:c(x.attestationObject),clientDataJSON:c(x.clientDataJSON),transports:w,publicKeyAlgorithm:k,publicKey:P,authenticatorData:v},type:H,clientExtensionResults:d.getClientExtensionResults(),authenticatorAttachment:D(d.authenticatorAttachment)}}function $(e,a){console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${e}. You should report this error to them.
`,a)}function le(){if(!b())return N.stubThis(new Promise(a=>a(!1)));let e=globalThis.PublicKeyCredential;return e?.isConditionalMediationAvailable===void 0?N.stubThis(new Promise(a=>a(!1))):N.stubThis(e.isConditionalMediationAvailable())}var N={stubThis:e=>e};function ue({error:e,options:a}){let{publicKey:t}=a;if(!t)throw Error("options was missing required publicKey property");if(e.name==="AbortError"){if(a.signal instanceof AbortSignal)return new p({message:"Authentication ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:e})}else{if(e.name==="NotAllowedError")return new p({message:e.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:e});if(e.name==="SecurityError"){let r=globalThis.location.hostname;if(M(r)){if(t.rpId!==r)return new p({message:`The RP ID "${t.rpId}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:e})}else return new p({message:`${globalThis.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:e})}else if(e.name==="UnknownError")return new p({message:"The authenticator was unable to process the specified options, or could not create a new assertion signature",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:e})}return e}async function de(e){!e.optionsJSON&&e.challenge&&(console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."),e={optionsJSON:e});let{optionsJSON:a,useBrowserAutofill:t=!1,verifyBrowserAutofillInput:r=!0}=e;if(!b())throw new Error("WebAuthn is not supported in this browser");let o;a.allowCredentials?.length!==0&&(o=a.allowCredentials?.map(R));let d={...a,challenge:S(a.challenge),allowCredentials:o},h={};if(t){if(!await le())throw Error("Browser does not support WebAuthn autofill");if(document.querySelectorAll("input[autocomplete$='webauthn']").length<1&&r)throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');h.mediation="conditional",d.allowCredentials=[]}h.publicKey=d,h.signal=T.createNewAbortSignal();let n;try{n=await navigator.credentials.get(h)}catch(v){throw ue({error:v,options:h})}if(!n)throw new Error("Authentication was not completed");let{id:x,rawId:H,response:w,type:k}=n,P;return w.userHandle&&(P=c(w.userHandle)),{id:x,rawId:c(H),response:{authenticatorData:c(w.authenticatorData),clientDataJSON:c(w.clientDataJSON),signature:c(w.signature),userHandle:P},type:k,clientExtensionResults:n.getClientExtensionResults(),authenticatorAttachment:D(n.authenticatorAttachment)}}var pe=(e,a,t=[])=>{let r=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(a).forEach(o=>{r.setAttribute(o,String(a[o]))}),t.length&&t.forEach(o=>{let d=pe(...o);r.appendChild(d)}),r},V=([e,a,t])=>pe(e,a,t);var s={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var G=["svg",s,[["path",{d:"M20 6 9 17l-5-5"}]]];var K=["svg",s,[["path",{d:"m9 18 6-6-6-6"}]]];var L=["svg",s,[["path",{d:"M18 20a6 6 0 0 0-12 0"}],["circle",{cx:"12",cy:"10",r:"4"}],["circle",{cx:"12",cy:"12",r:"10"}]]];var W=["svg",s,[["circle",{cx:"12",cy:"12",r:"10"}],["polyline",{points:"12 6 12 12 16.5 12"}]]];var _=["svg",s,[["path",{d:"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"}],["path",{d:"M14 13.12c0 2.38 0 6.38-1 8.88"}],["path",{d:"M17.29 21.02c.12-.6.43-2.3.5-3.02"}],["path",{d:"M2 12a10 10 0 0 1 18-6"}],["path",{d:"M2 16h.01"}],["path",{d:"M21.8 16c.2-2 .131-5.354 0-6"}],["path",{d:"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"}],["path",{d:"M8.65 22c.21-.66.45-1.32.57-2"}],["path",{d:"M9 6.8a6 6 0 0 1 9 5.2v2"}]]];var z=["svg",s,[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor"}]]];var B=["svg",s,[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56"}]]];var X=["svg",s,[["circle",{cx:"12",cy:"16",r:"1"}],["rect",{x:"3",y:"10",width:"18",height:"12",rx:"2"}],["path",{d:"M7 10V7a5 5 0 0 1 10 0v3"}]]];var J=["svg",s,[["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"}],["polyline",{points:"10 17 15 12 10 7"}],["line",{x1:"15",x2:"3",y1:"12",y2:"12"}]]];var Z=["svg",s,[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}],["polyline",{points:"16 17 21 12 16 7"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12"}]]];var j=["svg",s,[["rect",{x:"16",y:"16",width:"6",height:"6",rx:"1"}],["rect",{x:"2",y:"16",width:"6",height:"6",rx:"1"}],["rect",{x:"9",y:"2",width:"6",height:"6",rx:"1"}],["path",{d:"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"}],["path",{d:"M12 12V8"}]]];var O=["svg",s,[["path",{d:"M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"}],["path",{d:"m2 22 3-3"}],["path",{d:"M7.5 13.5 10 11"}],["path",{d:"M10.5 16.5 13 14"}],["path",{d:"m18 3-4 4h6l-4 4"}]]];var Y=["svg",s,[["path",{d:"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"}],["path",{d:"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"}],["path",{d:"M7 3v4a1 1 0 0 0 1 1h7"}]]];var Q=["svg",s,[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{d:"m9 12 2 2 4-4"}]]];var ee=["svg",s,[["path",{d:"M3 6h18"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17"}]]];var ae=["svg",s,[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{cx:"9",cy:"7",r:"4"}],["polyline",{points:"16 11 18 13 22 9"}]]];var F=["svg",s,[["path",{d:"M2 21a8 8 0 0 1 13.292-6"}],["circle",{cx:"10",cy:"8",r:"5"}],["path",{d:"M19 16v6"}],["path",{d:"M22 19h-6"}]]];var q=["svg",s,[["path",{d:"M18 21a8 8 0 0 0-16 0"}],["circle",{cx:"10",cy:"8",r:"5"}],["path",{d:"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"}]]];var Ce={Check:G,ChevronRight:K,CircleUserRound:L,Clock3:W,Fingerprint:_,KeyRound:z,LoaderCircle:B,LockKeyhole:X,LogIn:J,LogOut:Z,Network:j,PlugZap:O,Save:Y,ShieldCheck:Q,Trash2:ee,UserCheck:ae,UserRoundPlus:F,UsersRound:q},A=document.querySelector("#app"),we=document.querySelector("#toast-region"),f={user:null,view:"door",authMode:"login",passkeys:[],users:[],proxy:null};function l(e,a=""){let t=Ce[e];return t?V(t,{class:`icon ${a}`,"aria-hidden":"true"}).outerHTML:""}function C(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function te(e){return e?new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(e*1e3)):"\u5C1A\u672A\u767B\u5F55"}function u(e,a="default"){let t=document.createElement("div");t.className=`toast toast-${a}`,t.textContent=e,we.append(t),setTimeout(()=>t.remove(),4200)}async function i(e,a={}){let t=await fetch(e,{...a,headers:{"x-requested-with":"door-access",...a.body&&{"content-type":"application/json"},...a.headers}}),r=await t.json().catch(()=>({message:"\u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u5185\u5BB9"}));if(!t.ok){let o=new Error(r.message||"\u8BF7\u6C42\u5931\u8D25");throw o.status=t.status,o}return r}function m(e,a,t="\u5904\u7406\u4E2D"){e&&(a?(e.dataset.original=e.innerHTML,e.disabled=!0,e.innerHTML=`${l("LoaderCircle","spin")}<span>${t}</span>`):(e.disabled=!1,e.innerHTML=e.dataset.original??e.innerHTML))}function E(){let e=f.authMode==="login";A.innerHTML=`
    <main class="auth-layout">
      <section class="auth-pane">
        <div class="auth-inner">
          <div class="brand-lockup">
            <span class="brand-mark">${l("LockKeyhole")}</span>
            <span>\u667A\u80FD\u95E8\u7981</span>
          </div>

          <div class="auth-heading">
            <h1>${e?"\u6B22\u8FCE\u56DE\u6765":"\u7533\u8BF7\u95E8\u7981\u8D26\u53F7"}</h1>
            <p>${e?"\u767B\u5F55\u540E\u5373\u53EF\u5B89\u5168\u63A7\u5236\u95E8\u7981\u3002":"\u63D0\u4EA4\u6CE8\u518C\u540E\uFF0C\u7531\u7BA1\u7406\u5458\u5BA1\u6838\u5F00\u901A\u3002"}</p>
          </div>

          <div class="auth-tabs" role="tablist" aria-label="\u8D26\u53F7\u5165\u53E3">
            <button class="auth-tab ${e?"is-active":""}" data-auth-mode="login" type="button" role="tab" aria-selected="${e}">\u767B\u5F55</button>
            <button class="auth-tab ${e?"":"is-active"}" data-auth-mode="register" type="button" role="tab" aria-selected="${!e}">\u6CE8\u518C</button>
          </div>

          <form class="auth-form" id="${e?"login-form":"register-form"}">
            <label class="field">
              <span>\u7528\u6237\u540D</span>
              <input name="username" autocomplete="username webauthn" minlength="3" maxlength="32" required placeholder="\u8F93\u5165\u7528\u6237\u540D" />
            </label>
            <label class="field">
              <span>\u5BC6\u7801</span>
              <input name="password" type="password" autocomplete="${e?"current-password":"new-password"}" minlength="10" maxlength="128" required placeholder="\u81F3\u5C11 10 \u4E2A\u5B57\u7B26" />
            </label>
            ${e?"":`<label class="field">
                    <span>\u786E\u8BA4\u5BC6\u7801</span>
                    <input name="passwordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="\u518D\u6B21\u8F93\u5165\u5BC6\u7801" />
                  </label>`}
            <button class="button button-primary button-full" type="submit">
              ${l(e?"LogIn":"UserRoundPlus")}
              <span>${e?"\u767B\u5F55":"\u63D0\u4EA4\u7533\u8BF7"}</span>
            </button>
          </form>

          ${e?`<div class="divider"><span>\u6216</span></div>
                 <button class="button button-passkey button-full" id="passkey-login" type="button">
                   ${l("Fingerprint")}
                   <span>\u4F7F\u7528 Apple \u901A\u884C\u5BC6\u94A5</span>
                 </button>`:""}
        </div>
      </section>
      <section class="auth-visual" aria-label="\u667A\u80FD\u95E8\u9501">
        <img src="/assets/smart-entry.jpg" alt="\u624B\u673A\u63A7\u5236\u7684\u667A\u80FD\u95E8\u9501" />
        <div class="visual-caption">
          <span class="visual-icon">${l("ShieldCheck")}</span>
          <div><strong>\u5B89\u5168\u901A\u884C</strong><span>\u8D26\u53F7\u5BA1\u6838\u3001\u8BBE\u5907\u9A8C\u8BC1\u3001\u64CD\u4F5C\u7559\u75D5</span></div>
        </div>
      </section>
    </main>`}function y(e,a,t,r=""){return`<button class="nav-item ${f.view===e?"is-active":""}" data-view="${e}" type="button">
    ${l(a)}<span>${t}</span>${r}
  </button>`}function U(){let e=f.user.role==="admin"?`${y("users","UsersRound","\u7528\u6237\u7BA1\u7406")}${y("proxy","Network","\u4EE3\u7406\u8BBE\u7F6E")}`:"";A.innerHTML=`
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-lockup sidebar-brand">
          <span class="brand-mark">${l("LockKeyhole")}</span>
          <span>\u667A\u80FD\u95E8\u7981</span>
        </div>
        <nav class="primary-nav" aria-label="\u4E3B\u5BFC\u822A">
          ${y("door","KeyRound","\u95E8\u7981")}
          ${y("passkeys","ShieldCheck","\u8D26\u53F7\u5B89\u5168")}
          ${e}
        </nav>
        <button class="account-control" id="logout" type="button">
          <span class="avatar">${C(f.user.username.slice(0,1).toUpperCase())}</span>
          <span class="account-copy"><strong>${C(f.user.username)}</strong><small>${f.user.role==="admin"?"\u7BA1\u7406\u5458":"\u6210\u5458"}</small></span>
          ${l("LogOut")}
        </button>
      </aside>

      <main class="workspace">
        <header class="mobile-header">
          <div class="brand-lockup"><span class="brand-mark">${l("LockKeyhole")}</span><span>\u667A\u80FD\u95E8\u7981</span></div>
          <button class="icon-button" id="mobile-logout" type="button" title="\u9000\u51FA\u767B\u5F55">${l("LogOut")}</button>
        </header>
        <div class="view-container" id="view-container"></div>
      </main>

      <nav class="mobile-nav" aria-label="\u4E3B\u5BFC\u822A">
        ${y("door","KeyRound","\u95E8\u7981")}
        ${y("passkeys","ShieldCheck","\u5B89\u5168")}
        ${e}
      </nav>
    </div>`,ye()}function Se(){document.querySelector("#view-container").innerHTML=`
    <section class="view door-view">
      <div class="view-header centered-header">
        <span class="eyebrow">\u4E3B\u5165\u53E3</span>
        <h1>\u95E8\u7981\u63A7\u5236</h1>
        <p id="door-status-copy">\u8BBE\u5907\u5DF2\u5C31\u7EEA</p>
      </div>
      <div class="door-control state-idle" id="door-control">
        <div class="door-ring"></div>
        <button class="door-button" id="open-door" type="button" aria-label="\u70B9\u51FB\u5F00\u95E8">
          <span class="door-button-icon" id="door-button-icon">${l("KeyRound")}</span>
          <span id="door-button-label">\u5F00\u95E8</span>
        </button>
      </div>
      <div class="security-note">${l("ShieldCheck")}<span>\u64CD\u4F5C\u5C06\u8BB0\u5F55\u5230\u5B89\u5168\u65E5\u5FD7</span></div>
    </section>`}function ie(){document.querySelector("#view-container").innerHTML=`
    <section class="view">
      <div class="view-header split-header">
        <div><span class="eyebrow">\u4E2A\u4EBA\u8BBE\u7F6E</span><h1>\u8D26\u53F7\u5B89\u5168</h1><p>\u7BA1\u7406\u767B\u5F55\u5BC6\u7801\u548C\u5DF2\u7ED1\u5B9A\u7684\u901A\u884C\u5BC6\u94A5\u3002</p></div>
      </div>
      <div class="security-stack">
        <div class="content-panel password-panel">
          <div class="section-title"><h2>\u4FEE\u6539\u5BC6\u7801</h2><span>\u81F3\u5C11 10 \u4E2A\u5B57\u7B26</span></div>
          <div class="password-content">
            <div class="security-copy">
              <span class="item-icon password-icon">${l("KeyRound")}</span>
              <div><strong>\u767B\u5F55\u5BC6\u7801</strong><span>\u4FEE\u6539\u540E\uFF0C\u5176\u4ED6\u8BBE\u5907\u4E0A\u7684\u8D26\u53F7\u4F1A\u81EA\u52A8\u9000\u51FA\u3002</span></div>
            </div>
            <form class="security-form" id="change-password-form">
              <label class="field">
                <span>\u5F53\u524D\u5BC6\u7801</span>
                <input name="currentPassword" type="password" autocomplete="current-password" minlength="10" maxlength="128" required />
              </label>
              <label class="field">
                <span>\u65B0\u5BC6\u7801</span>
                <input name="newPassword" type="password" autocomplete="new-password" minlength="10" maxlength="128" required />
              </label>
              <label class="field">
                <span>\u786E\u8BA4\u65B0\u5BC6\u7801</span>
                <input name="newPasswordConfirm" type="password" autocomplete="new-password" minlength="10" maxlength="128" required />
              </label>
              <div class="form-actions">
                <button class="button button-primary" type="submit">${l("ShieldCheck")}<span>\u66F4\u65B0\u5BC6\u7801</span></button>
              </div>
            </form>
          </div>
        </div>

        <div class="content-panel">
          <div class="section-title section-title-action">
            <div><h2>Apple \u901A\u884C\u5BC6\u94A5</h2><span>${f.passkeys.length} \u4E2A\u5DF2\u7ED1\u5B9A\u8BBE\u5907</span></div>
            <button class="button button-small button-secondary" id="add-passkey" type="button">${l("Fingerprint")}<span>\u6DFB\u52A0</span></button>
          </div>
          <div class="item-list">
            ${f.passkeys.length?f.passkeys.map(e=>`<article class="list-item">
                        <span class="item-icon">${l("Fingerprint")}</span>
                        <div class="item-copy"><strong>${C(e.name)}</strong><span>${e.backedUp?"\u5DF2\u540C\u6B65\u5230 iCloud \u94A5\u5319\u4E32":"\u4EC5\u4FDD\u5B58\u5728\u5F53\u524D\u8BBE\u5907"} \xB7 \u6DFB\u52A0\u4E8E ${te(e.createdAt)}</span></div>
                        <button class="icon-button danger" type="button" data-delete-passkey="${encodeURIComponent(e.id)}" title="\u5220\u9664\u901A\u884C\u5BC6\u94A5">${l("Trash2")}</button>
                      </article>`).join(""):`<div class="empty-state compact-empty">${l("Fingerprint")}<strong>\u5C1A\u672A\u6DFB\u52A0\u901A\u884C\u5BC6\u94A5</strong><span>\u6DFB\u52A0\u540E\u53EF\u4EE5\u4F7F\u7528 Apple \u8BBE\u5907\u5FEB\u901F\u767B\u5F55\u3002</span></div>`}
          </div>
        </div>
      </div>
    </section>`}function be(e){return{pending:"\u5F85\u5BA1\u6838",active:"\u5DF2\u542F\u7528",disabled:"\u5DF2\u505C\u7528"}[e]??e}function ne(){let e=f.users.filter(a=>a.status==="pending").length;document.querySelector("#view-container").innerHTML=`
    <section class="view">
      <div class="view-header split-header">
        <div><span class="eyebrow">\u8BBF\u95EE\u63A7\u5236</span><h1>\u7528\u6237\u7BA1\u7406</h1><p>\u5BA1\u6838\u8D26\u53F7\u5E76\u7BA1\u7406\u95E8\u7981\u8BBF\u95EE\u6743\u9650\u3002</p></div>
        <div class="metric"><strong>${f.users.length}</strong><span>\u7528\u6237</span></div>
      </div>
      ${e?`<div class="pending-banner">${l("Clock3")}<span><strong>${e} \u4E2A\u8D26\u53F7</strong>\u7B49\u5F85\u5BA1\u6838</span></div>`:""}
      <div class="content-panel user-panel">
        <div class="section-title"><h2>\u5168\u90E8\u7528\u6237</h2><span>${f.users.length} \u4E2A</span></div>
        <div class="user-list">
          ${f.users.map(a=>`<article class="user-row" data-user-id="${a.id}">
                <span class="avatar user-avatar">${C(a.username.slice(0,1).toUpperCase())}</span>
                <div class="user-copy"><strong>${C(a.username)}${a.id===f.user.id?" <small>\u4F60</small>":""}</strong><span>\u4E0A\u6B21\u767B\u5F55\uFF1A${te(a.lastLoginAt)} \xB7 ${a.passkeyCount} \u4E2A\u901A\u884C\u5BC6\u94A5</span></div>
                <span class="status status-${a.status}">${be(a.status)}</span>
                <select class="select role-select" aria-label="${C(a.username)} \u7684\u89D2\u8272" ${a.id===f.user.id?"disabled":""}>
                  <option value="user" ${a.role==="user"?"selected":""}>\u6210\u5458</option>
                  <option value="admin" ${a.role==="admin"?"selected":""}>\u7BA1\u7406\u5458</option>
                </select>
                <div class="row-actions">
                  ${a.status==="pending"?`<button class="button button-small button-primary" data-user-status="active" type="button">${l("UserCheck")}<span>\u6279\u51C6</span></button>`:a.status==="active"&&a.id!==f.user.id?'<button class="button button-small button-secondary" data-user-status="disabled" type="button"><span>\u505C\u7528</span></button>':a.status==="disabled"?'<button class="button button-small button-secondary" data-user-status="active" type="button"><span>\u542F\u7528</span></button>':""}
                </div>
              </article>`).join("")}
        </div>
      </div>
    </section>`}function me(){let e=f.proxy??{enabled:!1,host:"",port:1080,username:"",hasPassword:!1,updatedAt:null};document.querySelector("#view-container").innerHTML=`
    <section class="view">
      <div class="view-header split-header">
        <div><span class="eyebrow">\u7F51\u7EDC\u51FA\u53E3</span><h1>SOCKS5 \u4EE3\u7406</h1><p>\u914D\u7F6E\u5F00\u95E8\u8BF7\u6C42\u4F7F\u7528\u7684\u52A0\u5BC6\u4EE3\u7406\u901A\u9053\u3002</p></div>
        <span class="status ${e.enabled?"status-active":"status-disabled"}">${e.enabled?"\u5DF2\u542F\u7528":"\u672A\u542F\u7528"}</span>
      </div>
      <div class="content-panel proxy-panel">
        <div class="section-title"><h2>\u8FDE\u63A5\u914D\u7F6E</h2><span>${e.updatedAt?`\u66F4\u65B0\u4E8E ${te(e.updatedAt)}`:"\u5C1A\u672A\u4FDD\u5B58"}</span></div>
        <form class="proxy-form" id="proxy-form">
          <label class="toggle-row">
            <span><strong>\u542F\u7528\u4EE3\u7406</strong><small>\u542F\u7528\u540E\uFF0C\u5F00\u95E8\u8BF7\u6C42\u901A\u8FC7\u6B64 SOCKS5 \u670D\u52A1\u5668\u53D1\u9001\u3002</small></span>
            <input name="enabled" type="checkbox" ${e.enabled?"checked":""} />
          </label>
          <div class="proxy-grid">
            <label class="field proxy-host-field">
              <span>\u670D\u52A1\u5668\u4E3B\u673A</span>
              <input name="host" value="${C(e.host)}" autocomplete="off" required placeholder="\u4F8B\u5982 203.0.113.10" />
            </label>
            <label class="field">
              <span>\u7AEF\u53E3</span>
              <input name="port" type="number" value="${e.port}" min="1" max="65535" required />
            </label>
            <label class="field">
              <span>\u7528\u6237\u540D</span>
              <input name="username" value="${C(e.username)}" autocomplete="off" maxlength="255" placeholder="\u53EF\u9009" />
            </label>
            <label class="field">
              <span>\u5BC6\u7801</span>
              <input name="password" type="password" autocomplete="new-password" maxlength="255" placeholder="${e.hasPassword?"\u7559\u7A7A\u4EE5\u4FDD\u7559\u5F53\u524D\u5BC6\u7801":"\u53EF\u9009"}" />
            </label>
          </div>
          <div class="proxy-result" id="proxy-result" aria-live="polite">
            ${l("Network")}<span>\u4FDD\u5B58\u524D\u53EF\u5148\u6D4B\u8BD5\u4EE3\u7406\u8FDE\u901A\u6027\uFF0C\u4E0D\u4F1A\u89E6\u53D1\u95E8\u9501\u3002</span>
          </div>
          <div class="proxy-actions">
            <button class="button button-secondary" id="test-proxy" type="button">${l("PlugZap")}<span>\u6D4B\u8BD5\u4EE3\u7406</span></button>
            <button class="button button-primary" type="submit">${l("Save")}<span>\u4FDD\u5B58\u914D\u7F6E</span></button>
          </div>
        </form>
      </div>
    </section>`}async function ye(){f.view==="passkeys"?(ie(),await re()):f.view==="users"&&f.user.role==="admin"?(ne(),await oe()):f.view==="proxy"&&f.user.role==="admin"?(me(),await xe()):(f.view="door",Se())}async function re(){try{f.passkeys=(await i("/api/passkeys")).passkeys,f.view==="passkeys"&&ie()}catch(e){u(e.message,"error")}}async function oe(){try{f.users=(await i("/api/admin/users")).users,f.view==="users"&&ne()}catch(e){u(e.message,"error")}}async function xe(){try{f.proxy=(await i("/api/admin/proxy")).proxy,f.view==="proxy"&&me()}catch(e){u(e.message,"error")}}function ce(e){let a=Object.fromEntries(new FormData(e));return{enabled:e.elements.enabled.checked,host:a.host,port:Number.parseInt(a.port,10),username:a.username,password:a.password}}async function Ae(e){let a=e.querySelector('button[type="submit"]');m(a,!0,"\u6B63\u5728\u4FDD\u5B58");try{let t=await i("/api/admin/proxy",{method:"PUT",body:JSON.stringify(ce(e))});u(t.message,"success"),await xe()}catch(t){u(t.message,"error")}finally{m(a,!1)}}async function Pe(e){let a=document.querySelector("#proxy-form"),t=document.querySelector("#proxy-result");m(e,!0,"\u6B63\u5728\u6D4B\u8BD5"),t.className="proxy-result is-testing",t.innerHTML=`${l("LoaderCircle","spin")}<span>\u6B63\u5728\u5EFA\u7ACB SOCKS5 \u4E0E TLS \u8FDE\u63A5</span>`;try{let r=await i("/api/admin/proxy/test",{method:"POST",body:JSON.stringify(ce(a))});t.className="proxy-result is-success",t.innerHTML=`${l("Check")}<span>\u8FDE\u63A5\u6210\u529F \xB7 \u51FA\u53E3 IP ${C(r.exitIp)} \xB7 ${r.latencyMs} ms</span>`}catch(r){t.className="proxy-result is-error",t.innerHTML=`${l("Network")}<span>${C(r.message)}</span>`}finally{m(e,!1)}}async function ve(e){let a=e.querySelector("button[type=submit]"),t=Object.fromEntries(new FormData(e));m(a,!0,f.authMode==="login"?"\u767B\u5F55\u4E2D":"\u63D0\u4EA4\u4E2D");try{if(f.authMode==="register"){if(t.password!==t.passwordConfirm)throw new Error("\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4");let r=await i("/api/auth/register",{method:"POST",body:JSON.stringify({username:t.username,password:t.password})});f.authMode="login",E(),u(r.message,"success")}else{let r=await i("/api/auth/login",{method:"POST",body:JSON.stringify({username:t.username,password:t.password})});f.user=r.user,U()}}catch(r){u(r.message,"error"),m(a,!1)}}async function ke(e){if(!window.PublicKeyCredential){u("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u901A\u884C\u5BC6\u94A5","error");return}m(e,!0,"\u6B63\u5728\u9A8C\u8BC1");try{let a=document.querySelector('input[name="username"]')?.value.trim()??"",t=await i("/api/passkeys/login/options",{method:"POST",body:JSON.stringify({username:a})}),r=await de({optionsJSON:t.options}),o=await i("/api/passkeys/login/verify",{method:"POST",body:JSON.stringify({challengeId:t.challengeId,response:r})});f.user=o.user,U()}catch(a){a.name!=="NotAllowedError"&&u(a.message,"error"),m(e,!1)}}async function Re(e){if(!window.PublicKeyCredential){u("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u901A\u884C\u5BC6\u94A5","error");return}m(e,!0,"\u6B63\u5728\u6DFB\u52A0");try{let a=await i("/api/passkeys/register/options",{method:"POST",body:"{}"}),t=await se({optionsJSON:a.options}),r=await i("/api/passkeys/register/verify",{method:"POST",body:JSON.stringify({challengeId:a.challengeId,response:t,name:/iPhone|iPad|Macintosh/.test(navigator.userAgent)?"iCloud \u94A5\u5319\u4E32":"\u901A\u884C\u5BC6\u94A5"})});u(r.message,"success"),await re()}catch(a){a.name!=="NotAllowedError"&&u(a.message,"error"),m(e,!1)}}async function Me(e){let a=e.querySelector("button[type=submit]"),t=Object.fromEntries(new FormData(e));if(t.newPassword!==t.newPasswordConfirm){u("\u4E24\u6B21\u8F93\u5165\u7684\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4","error");return}if(t.currentPassword===t.newPassword){u("\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C","error");return}m(a,!0,"\u6B63\u5728\u66F4\u65B0");try{let r=await i("/api/auth/password",{method:"POST",body:JSON.stringify({currentPassword:t.currentPassword,newPassword:t.newPassword})});e.reset(),u(r.message,"success")}catch(r){u(r.message,"error")}finally{m(a,!1)}}async function Te(){let e=document.querySelector("#door-control"),a=document.querySelector("#open-door"),t=document.querySelector("#door-button-label"),r=document.querySelector("#door-button-icon"),o=document.querySelector("#door-status-copy");if(!(!e||e.classList.contains("state-loading"))){e.className="door-control state-loading",a.disabled=!0,t.textContent="\u5F00\u542F\u4E2D",r.innerHTML=l("LoaderCircle","spin"),o.textContent="\u6B63\u5728\u8FDE\u63A5\u95E8\u9501";try{let d=await i("/api/open-door",{method:"POST",headers:{"x-door-action":"open"},body:"{}"});e.className="door-control state-success",t.textContent="\u5DF2\u5F00\u542F",r.innerHTML=l("Check"),o.textContent="\u95E8\u9501\u5DF2\u5F00\u542F",u(d.message||"\u95E8\u9501\u5DF2\u5F00\u542F","success")}catch(d){e.className="door-control state-error",t.textContent="\u5931\u8D25\u91CD\u8BD5",r.innerHTML=l("KeyRound"),o.textContent=d.message,u(d.message,"error")}setTimeout(()=>{e.className="door-control state-idle",a.disabled=!1,t.textContent="\u5F00\u95E8",r.innerHTML=l("KeyRound"),o.textContent="\u8BBE\u5907\u5DF2\u5C31\u7EEA"},3500)}}async function De(){try{await i("/api/auth/logout",{method:"POST",body:"{}"})}finally{f.user=null,f.view="door",E()}}A.addEventListener("click",async e=>{let a=e.target.closest("[data-auth-mode]");if(a){f.authMode=a.dataset.authMode,E();return}let t=e.target.closest("[data-view]");if(t){f.view=t.dataset.view,U();return}e.target.closest("#passkey-login")&&await ke(e.target.closest("button")),e.target.closest("#add-passkey")&&await Re(e.target.closest("button")),e.target.closest("#test-proxy")&&await Pe(e.target.closest("button")),e.target.closest("#open-door")&&await Te(),e.target.closest("#logout, #mobile-logout")&&await De();let r=e.target.closest("[data-delete-passkey]");if(r&&window.confirm("\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u901A\u884C\u5BC6\u94A5\u5417\uFF1F"))try{await i(`/api/passkeys/${r.dataset.deletePasskey}`,{method:"DELETE",body:"{}"}),u("\u901A\u884C\u5BC6\u94A5\u5DF2\u5220\u9664","success"),await re()}catch(d){u(d.message,"error")}let o=e.target.closest("[data-user-status]");if(o){let d=o.closest("[data-user-id]"),h=d.querySelector(".role-select").value;m(o,!0,"\u4FDD\u5B58\u4E2D");try{await i(`/api/admin/users/${d.dataset.userId}`,{method:"PATCH",body:JSON.stringify({status:o.dataset.userStatus,role:h})}),u(o.dataset.userStatus==="active"?"\u7528\u6237\u5DF2\u542F\u7528":"\u7528\u6237\u5DF2\u505C\u7528","success"),await oe()}catch(n){u(n.message,"error"),m(o,!1)}}});A.addEventListener("change",async e=>{if(!e.target.matches(".role-select"))return;let a=e.target.closest("[data-user-id]"),t=f.users.find(r=>r.id===a.dataset.userId);try{await i(`/api/admin/users/${a.dataset.userId}`,{method:"PATCH",body:JSON.stringify({status:t.status,role:e.target.value})}),u("\u7528\u6237\u89D2\u8272\u5DF2\u66F4\u65B0","success"),await oe()}catch(r){u(r.message,"error"),e.target.value=t.role}});A.addEventListener("submit",async e=>{if(e.target.matches("#proxy-form")){e.preventDefault(),await Ae(e.target);return}if(e.target.matches("#change-password-form")){e.preventDefault(),await Me(e.target);return}e.target.matches("#login-form, #register-form")&&(e.preventDefault(),await ve(e.target))});async function Le(){A.innerHTML=`<div class="app-loading">${l("LoaderCircle","spin")}<span>\u6B63\u5728\u8F7D\u5165</span></div>`;try{f.user=(await i("/api/auth/me")).user,U()}catch{E()}}Le();})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/check.js:
lucide/dist/esm/icons/chevron-right.js:
lucide/dist/esm/icons/circle-user-round.js:
lucide/dist/esm/icons/clock-3.js:
lucide/dist/esm/icons/fingerprint.js:
lucide/dist/esm/icons/key-round.js:
lucide/dist/esm/icons/loader-circle.js:
lucide/dist/esm/icons/lock-keyhole.js:
lucide/dist/esm/icons/log-in.js:
lucide/dist/esm/icons/log-out.js:
lucide/dist/esm/icons/network.js:
lucide/dist/esm/icons/plug-zap.js:
lucide/dist/esm/icons/save.js:
lucide/dist/esm/icons/shield-check.js:
lucide/dist/esm/icons/trash-2.js:
lucide/dist/esm/icons/user-check.js:
lucide/dist/esm/icons/user-round-plus.js:
lucide/dist/esm/icons/users-round.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
