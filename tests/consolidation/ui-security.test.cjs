const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('SEC-21: shared dialog escapes text and both attribute quote characters',()=>{
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../../js/momentum-ui.js',`file://${__filename}`),'utf8'),context);
 const ui=context.window.MomentumUI;
 assert.equal(ui.escapeAttribute('" onfocus="example()'), '&quot; onfocus=&quot;example()');
 assert.equal(ui.escapeText('</textarea><img src=x>'), '&lt;/textarea&gt;&lt;img src=x&gt;');
 assert.equal(ui.escapeText("A & B's `notes`"),'A &amp; B&#39;s &#96;notes&#96;');
 assert.equal(ui.escapeText(0),'0');assert.equal(ui.escapeText(null),'');
});

test('UX-14: keyboard focus wraps within the dialog and skips collapsed or disabled controls',()=>{
 let listener,focused;
 const doc={addEventListener(name,handler){assert.equal(name,'keydown');listener=handler;}};
 const dialog={querySelectorAll(){return controls;},closest(){return dialog;}};
 const control=(name,{hidden=false,disabled=false}={})=>({name,tabIndex:0,closest(selector){return selector==='dialog[open]'?dialog:null;},matches(){return disabled;},getClientRects(){return hidden?[]:[{}];},focus(){focused=name;}});
 const first=control('close'),last=control('save'),controls=[first,control('collapsed',{hidden:true}),control('disabled',{disabled:true}),last];
 const context={window:{document:doc,getComputedStyle(){return {visibility:'visible'};}}};
 vm.runInNewContext(fs.readFileSync(new URL('../../js/momentum-ui.js',`file://${__filename}`),'utf8'),context);
 let prevented=0;doc.activeElement=first;listener({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(focused,'save');
 doc.activeElement=last;listener({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(focused,'close');assert.equal(prevented,2);
 doc.activeElement=dialog;listener({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(focused,'save');
 listener({key:'Escape',preventDefault(){throw new Error('Native escape must stay available');}});
});
