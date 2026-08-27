(()=>{function x(e){let a=new Uint8Array(e),t="";for(let o of a)t+=String.fromCharCode(o);return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}function w(e){let a=e.replace(/-/g,"+").replace(/_/g,"/"),t=(4-a.length%4)%4,r=a.padEnd(a.length+t,"="),o=atob(r),u=new ArrayBuffer(o.length),c=new Uint8Array(u);for(let n=0;n<o.length;n++)c[n]=o.charCodeAt(n);return u}function S(){return pe.stubThis(globalThis?.PublicKeyCredential!==void 0&&typeof globalThis.PublicKeyCredential=="function")}var pe={stubThis:e=>e};function v(e){let{id:a}=e;return{...e,id:w(a),transports:e.transports}}function T(e){return e==="localhost"||/^((xn--[a-z0-9-]+|[a-z0-9]+(-[a-z0-9]+)*)\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(e)}var d=class extends Error{constructor({message:a,code:t,cause:r,name:o}){super(a,{cause:r}),Object.defineProperty(this,"code",{enumerable:!0,configurable:!0,writable:!0,value:void 0}),this.name=o??r.name,this.code=t}};function ae({error:e,options:a}){let{publicKey:t}=a;if(!t)throw Error("options was missing required publicKey property");if(e.name==="AbortError"){if(a.signal instanceof AbortSignal)return new d({message:"Registration ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:e})}else if(e.name==="ConstraintError"){if(t.authenticatorSelection?.requireResidentKey===!0)return new d({message:"Discoverable credentials were required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",cause:e});if(a.mediation==="conditional"&&t.authenticatorSelection?.userVerification==="required")return new d({message:"User verification was required during automatic registration but it could not be performed",code:"ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",cause:e});if(t.authenticatorSelection?.userVerification==="required")return new d({message:"User verification was required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",cause:e})}else{if(e.name==="InvalidStateError")return new d({message:"The authenticator was previously registered",code:"ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",cause:e});if(e.name==="NotAllowedError")return new d({message:e.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:e});if(e.name==="NotSupportedError")return t.pubKeyCredParams.filter(o=>o.type==="public-key").length===0?new d({message:'No entry in pubKeyCredParams was of type "public-key"',code:"ERROR_MALFORMED_PUBKEYCREDPARAMS",cause:e}):new d({message:"No available authenticator supported any of the specified pubKeyCredParams algorithms",code:"ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",cause:e});if(e.name==="SecurityError"){let r=globalThis.location.hostname;if(T(r)){if(t.rp.id!==r)return new d({message:`The RP ID "${t.rp.id}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:e})}else return new d({message:`${globalThis.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:e})}else if(e.name==="TypeError"){if(t.user.id.byteLength<1||t.user.id.byteLength>64)return new d({message:"User ID was not between 1 and 64 characters",code:"ERROR_INVALID_USER_ID_LENGTH",cause:e})}else if(e.name==="UnknownError")return new d({message:"The authenticator was unable to process the specified options, or could not create a new credential",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:e})}return e}var H=class{constructor(){Object.defineProperty(this,"controller",{enumerable:!0,configurable:!0,writable:!0,value:void 0})}createNewAbortSignal(){if(this.controller){let t=new Error("Cancelling existing WebAuthn API call for new one");t.name="AbortError",this.controller.abort(t)}let a=new AbortController;return this.controller=a,a.signal}cancelCeremony(){if(this.controller){let a=new Error("Manually cancelling existing WebAuthn API call");a.name="AbortError",this.controller.abort(a),this.controller=void 0}}},M=new H;var ie=["cross-platform","platform"];function D(e){if(e&&!(ie.indexOf(e)<0))return e}async function te(e){!e.optionsJSON&&e.challenge&&(console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."),e={optionsJSON:e});let{optionsJSON:a,useAutoRegister:t=!1}=e;if(!S())throw new Error("WebAuthn is not supported in this browser");let r={...a,challenge:w(a.challenge),user:{...a.user,id:w(a.user.id)},excludeCredentials:a.excludeCredentials?.map(v)},o={};t&&(o.mediation="conditional"),o.publicKey=r,o.signal=M.createNewAbortSignal();let u;try{u=await navigator.credentials.create(o)}catch(h){throw ae({error:h,options:o})}if(!u)throw new Error("Registration was not completed");let{id:c,rawId:n,response:m,type:U}=u,C;typeof m.getTransports=="function"&&(C=m.getTransports());let R;if(typeof m.getPublicKeyAlgorithm=="function")try{R=m.getPublicKeyAlgorithm()}catch(h){I("getPublicKeyAlgorithm()",h)}let A;if(typeof m.getPublicKey=="function")try{let h=m.getPublicKey();h!==null&&(A=x(h))}catch(h){I("getPublicKey()",h)}let P;if(typeof m.getAuthenticatorData=="function")try{P=x(m.getAuthenticatorData())}catch(h){I("getAuthenticatorData()",h)}return{id:c,rawId:x(n),response:{attestationObject:x(m.attestationObject),clientDataJSON:x(m.clientDataJSON),transports:C,publicKeyAlgorithm:R,publicKey:A,authenticatorData:P},type:U,clientExtensionResults:u.getClientExtensionResults(),authenticatorAttachment:D(u.authenticatorAttachment)}}function I(e,a){console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${e}. You should report this error to them.
`,a)}function re(){if(!S())return N.stubThis(new Promise(a=>a(!1)));let e=globalThis.PublicKeyCredential;return e?.isConditionalMediationAvailable===void 0?N.stubThis(new Promise(a=>a(!1))):N.stubThis(e.isConditionalMediationAvailable())}var N={stubThis:e=>e};function oe({error:e,options:a}){let{publicKey:t}=a;if(!t)throw Error("options was missing required publicKey property");if(e.name==="AbortError"){if(a.signal instanceof AbortSignal)return new d({message:"Authentication ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:e})}else{if(e.name==="NotAllowedError")return new d({message:e.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:e});if(e.name==="SecurityError"){let r=globalThis.location.hostname;if(T(r)){if(t.rpId!==r)return new d({message:`The RP ID "${t.rpId}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:e})}else return new d({message:`${globalThis.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:e})}else if(e.name==="UnknownError")return new d({message:"The authenticator was unable to process the specified options, or could not create a new assertion signature",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:e})}return e}async function fe(e){!e.optionsJSON&&e.challenge&&(console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information."),e={optionsJSON:e});let{optionsJSON:a,useBrowserAutofill:t=!1,verifyBrowserAutofillInput:r=!0}=e;if(!S())throw new Error("WebAuthn is not supported in this browser");let o;a.allowCredentials?.length!==0&&(o=a.allowCredentials?.map(v));let u={...a,challenge:w(a.challenge),allowCredentials:o},c={};if(t){if(!await re())throw Error("Browser does not support WebAuthn autofill");if(document.querySelectorAll("input[autocomplete$='webauthn']").length<1&&r)throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');c.mediation="conditional",u.allowCredentials=[]}c.publicKey=u,c.signal=M.createNewAbortSignal();let n;try{n=await navigator.credentials.get(c)}catch(P){throw oe({error:P,options:c})}if(!n)throw new Error("Authentication was not completed");let{id:m,rawId:U,response:C,type:R}=n,A;return C.userHandle&&(A=x(C.userHandle)),{id:m,rawId:x(U),response:{authenticatorData:x(C.authenticatorData),clientDataJSON:x(C.clientDataJSON),signature:x(C.signature),userHandle:A},type:R,clientExtensionResults:n.getClientExtensionResults(),authenticatorAttachment:D(n.authenticatorAttachment)}}var se=(e,a,t=[])=>{let r=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(a).forEach(o=>{r.setAttribute(o,String(a[o]))}),t.length&&t.forEach(o=>{let u=se(...o);r.appendChild(u)}),r},$=([e,a,t])=>se(e,a,t);var s={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var V=["svg",s,[["path",{d:"M20 6 9 17l-5-5"}]]];var G=["svg",s,[["path",{d:"m9 18 6-6-6-6"}]]];var L=["svg",s,[["path",{d:"M18 20a6 6 0 0 0-12 0"}],["circle",{cx:"12",cy:"10",r:"4"}],["circle",{cx:"12",cy:"12",r:"10"}]]];var K=["svg",s,[["circle",{cx:"12",cy:"12",r:"10"}],["polyline",{points:"12 6 12 12 16.5 12"}]]];var W=["svg",s,[["path",{d:"M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"}],["path",{d:"M14 13.12c0 2.38 0 6.38-1 8.88"}],["path",{d:"M17.29 21.02c.12-.6.43-2.3.5-3.02"}],["path",{d:"M2 12a10 10 0 0 1 18-6"}],["path",{d:"M2 16h.01"}],["path",{d:"M21.8 16c.2-2 .131-5.354 0-6"}],["path",{d:"M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"}],["path",{d:"M8.65 22c.21-.66.45-1.32.57-2"}],["path",{d:"M9 6.8a6 6 0 0 1 9 5.2v2"}]]];var _=["svg",s,[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor"}]]];var B=["svg",s,[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56"}]]];var z=["svg",s,[["circle",{cx:"12",cy:"16",r:"1"}],["rect",{x:"3",y:"10",width:"18",height:"12",rx:"2"}],["path",{d:"M7 10V7a5 5 0 0 1 10 0v3"}]]];var X=["svg",s,[["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"}],["polyline",{points:"10 17 15 12 10 7"}],["line",{x1:"15",x2:"3",y1:"12",y2:"12"}]]];var J=["svg",s,[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}],["polyline",{points:"16 17 21 12 16 7"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12"}]]];var j=["svg",s,[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{d:"m9 12 2 2 4-4"}]]];var Z=["svg",s,[["path",{d:"M3 6h18"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17"}]]];var Y=["svg",s,[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{cx:"9",cy:"7",r:"4"}],["polyline",{points:"16 11 18 13 22 9"}]]];var F=["svg",s,[["path",{d:"M2 21a8 8 0 0 1 13.292-6"}],["circle",{cx:"10",cy:"8",r:"5"}],["path",{d:"M19 16v6"}],["path",{d:"M22 19h-6"}]]];var O=["svg",s,[["path",{d:"M18 21a8 8 0 0 0-16 0"}],["circle",{cx:"10",cy:"8",r:"5"}],["path",{d:"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"}]]];var ne={Check:V,ChevronRight:G,CircleUserRound:L,Clock3:K,Fingerprint:W,KeyRound:_,LoaderCircle:B,LockKeyhole:z,LogIn:X,LogOut:J,ShieldCheck:j,Trash2:Z,UserCheck:Y,UserRoundPlus:F,UsersRound:O},y=document.querySelector("#app"),me=document.querySelector("#toast-region"),f={user:null,view:"door",authMode:"login",passkeys:[],users:[]};function l(e,a=""){let t=ne[e];return t?$(t,{class:`icon ${a}`,"aria-hidden":"true"}).outerHTML:""}function b(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function le(e){return e?new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(e*1e3)):"\u5C1A\u672A\u767B\u5F55"}function p(e,a="default"){let t=document.createElement("div");t.className=`toast toast-${a}`,t.textContent=e,me.append(t),setTimeout(()=>t.remove(),4200)}async function i(e,a={}){let t=await fetch(e,{...a,headers:{"x-requested-with":"door-access",...a.body&&{"content-type":"application/json"},...a.headers}}),r=await t.json().catch(()=>({message:"\u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u5185\u5BB9"}));if(!t.ok){let o=new Error(r.message||"\u8BF7\u6C42\u5931\u8D25");throw o.status=t.status,o}return r}function g(e,a,t="\u5904\u7406\u4E2D"){e&&(a?(e.dataset.original=e.innerHTML,e.disabled=!0,e.innerHTML=`${l("LoaderCircle","spin")}<span>${t}</span>`):(e.disabled=!1,e.innerHTML=e.dataset.original??e.innerHTML))}function q(){let e=f.authMode==="login";y.innerHTML=`
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
    </main>`}function k(e,a,t,r=""){return`<button class="nav-item ${f.view===e?"is-active":""}" data-view="${e}" type="button">
    ${l(a)}<span>${t}</span>${r}
  </button>`}function E(){let e=f.user.role==="admin"?k("users","UsersRound","\u7528\u6237\u7BA1\u7406"):"";y.innerHTML=`
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-lockup sidebar-brand">
          <span class="brand-mark">${l("LockKeyhole")}</span>
          <span>\u667A\u80FD\u95E8\u7981</span>
        </div>
        <nav class="primary-nav" aria-label="\u4E3B\u5BFC\u822A">
          ${k("door","KeyRound","\u95E8\u7981")}
          ${k("passkeys","ShieldCheck","\u8D26\u53F7\u5B89\u5168")}
          ${e}
        </nav>
        <button class="account-control" id="logout" type="button">
          <span class="avatar">${b(f.user.username.slice(0,1).toUpperCase())}</span>
          <span class="account-copy"><strong>${b(f.user.username)}</strong><small>${f.user.role==="admin"?"\u7BA1\u7406\u5458":"\u6210\u5458"}</small></span>
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
        ${k("door","KeyRound","\u95E8\u7981")}
        ${k("passkeys","ShieldCheck","\u5B89\u5168")}
        ${e}
      </nav>
    </div>`,he()}function xe(){document.querySelector("#view-container").innerHTML=`
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
    </section>`}function ue(){document.querySelector("#view-container").innerHTML=`
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
                        <div class="item-copy"><strong>${b(e.name)}</strong><span>${e.backedUp?"\u5DF2\u540C\u6B65\u5230 iCloud \u94A5\u5319\u4E32":"\u4EC5\u4FDD\u5B58\u5728\u5F53\u524D\u8BBE\u5907"} \xB7 \u6DFB\u52A0\u4E8E ${le(e.createdAt)}</span></div>
                        <button class="icon-button danger" type="button" data-delete-passkey="${encodeURIComponent(e.id)}" title="\u5220\u9664\u901A\u884C\u5BC6\u94A5">${l("Trash2")}</button>
                      </article>`).join(""):`<div class="empty-state compact-empty">${l("Fingerprint")}<strong>\u5C1A\u672A\u6DFB\u52A0\u901A\u884C\u5BC6\u94A5</strong><span>\u6DFB\u52A0\u540E\u53EF\u4EE5\u4F7F\u7528 Apple \u8BBE\u5907\u5FEB\u901F\u767B\u5F55\u3002</span></div>`}
          </div>
        </div>
      </div>
    </section>`}function ce(e){return{pending:"\u5F85\u5BA1\u6838",active:"\u5DF2\u542F\u7528",disabled:"\u5DF2\u505C\u7528"}[e]??e}function de(){let e=f.users.filter(a=>a.status==="pending").length;document.querySelector("#view-container").innerHTML=`
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
                <span class="avatar user-avatar">${b(a.username.slice(0,1).toUpperCase())}</span>
                <div class="user-copy"><strong>${b(a.username)}${a.id===f.user.id?" <small>\u4F60</small>":""}</strong><span>\u4E0A\u6B21\u767B\u5F55\uFF1A${le(a.lastLoginAt)} \xB7 ${a.passkeyCount} \u4E2A\u901A\u884C\u5BC6\u94A5</span></div>
                <span class="status status-${a.status}">${ce(a.status)}</span>
                <select class="select role-select" aria-label="${b(a.username)} \u7684\u89D2\u8272" ${a.id===f.user.id?"disabled":""}>
                  <option value="user" ${a.role==="user"?"selected":""}>\u6210\u5458</option>
                  <option value="admin" ${a.role==="admin"?"selected":""}>\u7BA1\u7406\u5458</option>
                </select>
                <div class="row-actions">
                  ${a.status==="pending"?`<button class="button button-small button-primary" data-user-status="active" type="button">${l("UserCheck")}<span>\u6279\u51C6</span></button>`:a.status==="active"&&a.id!==f.user.id?'<button class="button button-small button-secondary" data-user-status="disabled" type="button"><span>\u505C\u7528</span></button>':a.status==="disabled"?'<button class="button button-small button-secondary" data-user-status="active" type="button"><span>\u542F\u7528</span></button>':""}
                </div>
              </article>`).join("")}
        </div>
      </div>
    </section>`}async function he(){f.view==="passkeys"?(ue(),await Q()):f.view==="users"&&f.user.role==="admin"?(de(),await ee()):(f.view="door",xe())}async function Q(){try{f.passkeys=(await i("/api/passkeys")).passkeys,f.view==="passkeys"&&ue()}catch(e){p(e.message,"error")}}async function ee(){try{f.users=(await i("/api/admin/users")).users,f.view==="users"&&de()}catch(e){p(e.message,"error")}}async function ge(e){let a=e.querySelector("button[type=submit]"),t=Object.fromEntries(new FormData(e));g(a,!0,f.authMode==="login"?"\u767B\u5F55\u4E2D":"\u63D0\u4EA4\u4E2D");try{if(f.authMode==="register"){if(t.password!==t.passwordConfirm)throw new Error("\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4");let r=await i("/api/auth/register",{method:"POST",body:JSON.stringify({username:t.username,password:t.password})});f.authMode="login",q(),p(r.message,"success")}else{let r=await i("/api/auth/login",{method:"POST",body:JSON.stringify({username:t.username,password:t.password})});f.user=r.user,E()}}catch(r){p(r.message,"error"),g(a,!1)}}async function Ce(e){if(!window.PublicKeyCredential){p("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u901A\u884C\u5BC6\u94A5","error");return}g(e,!0,"\u6B63\u5728\u9A8C\u8BC1");try{let a=document.querySelector('input[name="username"]')?.value.trim()??"",t=await i("/api/passkeys/login/options",{method:"POST",body:JSON.stringify({username:a})}),r=await fe({optionsJSON:t.options}),o=await i("/api/passkeys/login/verify",{method:"POST",body:JSON.stringify({challengeId:t.challengeId,response:r})});f.user=o.user,E()}catch(a){a.name!=="NotAllowedError"&&p(a.message,"error"),g(e,!1)}}async function we(e){if(!window.PublicKeyCredential){p("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u901A\u884C\u5BC6\u94A5","error");return}g(e,!0,"\u6B63\u5728\u6DFB\u52A0");try{let a=await i("/api/passkeys/register/options",{method:"POST",body:"{}"}),t=await te({optionsJSON:a.options}),r=await i("/api/passkeys/register/verify",{method:"POST",body:JSON.stringify({challengeId:a.challengeId,response:t,name:/iPhone|iPad|Macintosh/.test(navigator.userAgent)?"iCloud \u94A5\u5319\u4E32":"\u901A\u884C\u5BC6\u94A5"})});p(r.message,"success"),await Q()}catch(a){a.name!=="NotAllowedError"&&p(a.message,"error"),g(e,!1)}}async function Se(e){let a=e.querySelector("button[type=submit]"),t=Object.fromEntries(new FormData(e));if(t.newPassword!==t.newPasswordConfirm){p("\u4E24\u6B21\u8F93\u5165\u7684\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4","error");return}if(t.currentPassword===t.newPassword){p("\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C","error");return}g(a,!0,"\u6B63\u5728\u66F4\u65B0");try{let r=await i("/api/auth/password",{method:"POST",body:JSON.stringify({currentPassword:t.currentPassword,newPassword:t.newPassword})});e.reset(),p(r.message,"success")}catch(r){p(r.message,"error")}finally{g(a,!1)}}async function be(){let e=document.querySelector("#door-control"),a=document.querySelector("#open-door"),t=document.querySelector("#door-button-label"),r=document.querySelector("#door-button-icon"),o=document.querySelector("#door-status-copy");if(!(!e||e.classList.contains("state-loading"))){e.className="door-control state-loading",a.disabled=!0,t.textContent="\u5F00\u542F\u4E2D",r.innerHTML=l("LoaderCircle","spin"),o.textContent="\u6B63\u5728\u8FDE\u63A5\u95E8\u9501";try{let u=await i("/api/open-door",{method:"POST",headers:{"x-door-action":"open"},body:"{}"});e.className="door-control state-success",t.textContent="\u5DF2\u5F00\u542F",r.innerHTML=l("Check"),o.textContent="\u95E8\u9501\u5DF2\u5F00\u542F",p(u.message||"\u95E8\u9501\u5DF2\u5F00\u542F","success")}catch(u){e.className="door-control state-error",t.textContent="\u5931\u8D25\u91CD\u8BD5",r.innerHTML=l("KeyRound"),o.textContent=u.message,p(u.message,"error")}setTimeout(()=>{e.className="door-control state-idle",a.disabled=!1,t.textContent="\u5F00\u95E8",r.innerHTML=l("KeyRound"),o.textContent="\u8BBE\u5907\u5DF2\u5C31\u7EEA"},3500)}}async function ye(){try{await i("/api/auth/logout",{method:"POST",body:"{}"})}finally{f.user=null,f.view="door",q()}}y.addEventListener("click",async e=>{let a=e.target.closest("[data-auth-mode]");if(a){f.authMode=a.dataset.authMode,q();return}let t=e.target.closest("[data-view]");if(t){f.view=t.dataset.view,E();return}e.target.closest("#passkey-login")&&await Ce(e.target.closest("button")),e.target.closest("#add-passkey")&&await we(e.target.closest("button")),e.target.closest("#open-door")&&await be(),e.target.closest("#logout, #mobile-logout")&&await ye();let r=e.target.closest("[data-delete-passkey]");if(r&&window.confirm("\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u901A\u884C\u5BC6\u94A5\u5417\uFF1F"))try{await i(`/api/passkeys/${r.dataset.deletePasskey}`,{method:"DELETE",body:"{}"}),p("\u901A\u884C\u5BC6\u94A5\u5DF2\u5220\u9664","success"),await Q()}catch(u){p(u.message,"error")}let o=e.target.closest("[data-user-status]");if(o){let u=o.closest("[data-user-id]"),c=u.querySelector(".role-select").value;g(o,!0,"\u4FDD\u5B58\u4E2D");try{await i(`/api/admin/users/${u.dataset.userId}`,{method:"PATCH",body:JSON.stringify({status:o.dataset.userStatus,role:c})}),p(o.dataset.userStatus==="active"?"\u7528\u6237\u5DF2\u542F\u7528":"\u7528\u6237\u5DF2\u505C\u7528","success"),await ee()}catch(n){p(n.message,"error"),g(o,!1)}}});y.addEventListener("change",async e=>{if(!e.target.matches(".role-select"))return;let a=e.target.closest("[data-user-id]"),t=f.users.find(r=>r.id===a.dataset.userId);try{await i(`/api/admin/users/${a.dataset.userId}`,{method:"PATCH",body:JSON.stringify({status:t.status,role:e.target.value})}),p("\u7528\u6237\u89D2\u8272\u5DF2\u66F4\u65B0","success"),await ee()}catch(r){p(r.message,"error"),e.target.value=t.role}});y.addEventListener("submit",async e=>{if(e.target.matches("#change-password-form")){e.preventDefault(),await Se(e.target);return}e.target.matches("#login-form, #register-form")&&(e.preventDefault(),await ge(e.target))});async function Ae(){y.innerHTML=`<div class="app-loading">${l("LoaderCircle","spin")}<span>\u6B63\u5728\u8F7D\u5165</span></div>`;try{f.user=(await i("/api/auth/me")).user,E()}catch{q()}}Ae();})();
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
