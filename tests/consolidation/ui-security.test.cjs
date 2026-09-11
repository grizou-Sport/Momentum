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
