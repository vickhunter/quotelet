// Everything is scoped to the shadow root. :host resets inherited host CSS with `all: initial`
// (important declarations inside a shadow tree beat the outer page's important declarations);
// only the five --ql-* custom properties flow in from the host page.
export const CSS = `:host{all:initial!important;display:block!important;font-family:var(--ql-font,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif)!important;font-size:16px!important;line-height:1.4!important;color:var(--ql-text,#1f2328)!important;text-align:left!important}
:host([hidden]){display:none!important}
*{box-sizing:border-box;margin:0;padding:0;font:inherit;color:inherit;letter-spacing:normal;text-transform:none}
[hidden]{display:none!important}
.ql{background:var(--ql-bg,#fff);border:1px solid rgba(0,0,0,.12);border-radius:var(--ql-radius,12px);padding:16px;max-width:520px;width:100%}
.t{font-size:20px;font-weight:700;margin-bottom:12px;overflow-wrap:anywhere}
.row{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.row.tg{flex-direction:row;align-items:center;gap:10px}
label{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.in{display:flex;align-items:center;gap:8px}
input,select{font-size:16px;padding:8px 10px;min-height:44px;width:100%;border:1px solid rgba(0,0,0,.3);border-radius:8px;background:#fff;color:#1f2328}
input[type=checkbox]{width:22px;height:22px;min-height:0;flex:none;accent-color:var(--ql-accent,#2563eb)}
input:focus,select:focus,button:focus{outline:2px solid var(--ql-accent,#2563eb);outline-offset:1px}
input[aria-invalid=true]{border-color:#b42318}
.u{font-size:14px;white-space:nowrap}
.res{background:rgba(0,0,0,.04);border-radius:var(--ql-radius,12px);padding:12px;margin:4px 0 12px}
.lb{font-size:13px;font-weight:600;opacity:.75}
.amt{font-size:24px;font-weight:700;overflow-wrap:anywhere}
.sm{font-size:13px;opacity:.8;margin-top:4px;overflow-wrap:anywhere}
.disc{margin:0 0 12px}
.hint{font-size:13px;color:#b42318;margin-top:4px}
button{display:block;width:100%;min-height:48px;margin-top:8px;border:0;border-radius:var(--ql-radius,12px);background:var(--ql-accent,#2563eb);color:#fff;font-weight:700;cursor:pointer}
button.alt{background:transparent;color:var(--ql-accent,#2563eb);border:1px solid currentColor}
.err{border:1px solid #b42318;background:#fef3f2;color:#912018;padding:12px;border-radius:var(--ql-radius,12px)}
.err ul{margin:8px 0 0 18px;font-size:13px}
.badge{font-size:11px;opacity:.6;margin-top:10px;text-align:right}`;
