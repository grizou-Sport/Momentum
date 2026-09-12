const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const load=require('../../js/momentum-training-load.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../../js',file),'utf8');

test('MOM-01/DAT-05: explicit practice variants control eligibility without category inference',()=>{
 const context={window:{addEventListener(){}}};vm.createContext(context);
 for(const file of ['momentum-sports.js','momentum-wellbeing.js','momentum-moment-form.js','momentum-data.js'])vm.runInContext(read(file),context);
 const preferences=context.window.MomentumMomentForm.preferredPractices([
  {role:'Secondaire',sports:{name:'Vélo'}},{role:'Principal',sports:{name:'Course à pied'}},{role:'Principal',active:false,sports:{name:'Natation'}}
 ]);
 assert.deepEqual(Array.from(preferences),['running','cycling']);
 for(const [label,id] of [['Yoga','yoga'],['Mobilité','mobility'],['Étirements','stretching']]){
  assert.equal(load.requiresVariant(id),true);
  const row=context.window.MomentumData.trainingActivity({activity_category:'wellbeing',activity_type:label,duration_min:60,rpe:6,status:'done'});
  assert.equal(load.activityLoad(row).eligibility,'undetermined');
  assert.equal(load.activityLoad({...row,practice_variant:'active'}).load,60);
  assert.equal(load.activityLoad({...row,practice_variant:'passive'}).eligibility,'excluded');
 }
 assert.equal(load.requiresVariant('massage'),false);
});

test('MOM-01: selecting an unspecified adventure cannot retain the previous sport',()=>{
 const select={value:'adventure_unspecified'},sport={value:'running'},type={value:'',options:[],add(option){this.options.push(option);}};
 const variant={value:'active'},category={checked:false,dispatchEvent(){}};
 const form={elements:{sport,adventure_activity_type:type,practice_variant:variant},querySelector(selector){
  if(selector==='[data-moment-nature]')return select;
  if(selector.startsWith('[name="activity_category"]'))return category;
  return null;
 }};
 const context={Event,Option:function(label,value){this.label=label;this.value=value;},window:{addEventListener(){},MomentumTrainingLoad:load}};vm.createContext(context);
 vm.runInContext(read('momentum-moment-form.js'),context);
 context.window.MomentumMomentForm.syncNature(form);
 assert.equal(sport.value,'');assert.equal(type.value,'Autre');assert.equal(variant.value,'');assert.equal(category.checked,true);
});

test('MOM-01/18: editing restores variant, qualifiers and memorable flag before optional experience finishes',async()=>{
 const fields=new Proxy({practice_variant:{value:''},is_memorable:{checked:false}}, {get(target,key){return target[key]??=( {value:''} );}});
 const qualifiers=[{value:'adventure',checked:false},{value:'together',checked:false},{value:'discovery',checked:false}];
 const form={elements:fields,dataset:{formVersion:'same'},querySelector(){return {checked:false};},querySelectorAll(selector){return selector==='[name="qualifiers"]'?qualifiers:[];}};
 const activity={id:'one',date:'2026-09-01',category:'wellbeing',type:'Mobilité',original:{practice_variant:'active'},qualifiers:['adventure','discovery'],isMemorable:true};
 let release;const context={state:{sessions:[activity]},window:{MomentumMomentForm:{syncNature(){}}},$:selector=>selector==='#activityForm'?form:null};
 vm.createContext(context);vm.runInContext(read('home-activities.js'),context);
 Object.assign(context,{openActivityDialog(){},updateActivityFormCategory(){},setFormValue(f,key,value){f.elements[key].value=value;},setSelectValue(f,key,value){f.elements[key].value=value;},setDurationFormValues(){},updateExperienceVisibility(){},loadActivityExperience:()=>new Promise(resolve=>{release=resolve;})});
 const loading=context.openEditActivityDialog('one');
 assert.equal(fields.practice_variant.value,'active');assert.equal(fields.is_memorable.checked,true);
 assert.deepEqual(qualifiers.map(input=>input.checked),[true,false,true]);assert.equal(fields.wellbeing_activity_type.value,'Mobilité');
 fields.wellbeing_activity_type.value='Étirements';release();await loading;
 assert.equal(fields.wellbeing_activity_type.value,'Étirements');
});

test('UX-08: direct arrival targets content after the Hero, while deep links take precedence',async()=>{
 for(const [search,hash,expected] of [['','',1],['?view=account','',0],['','#flow',0]]){
  const target={id:'useful',tabIndex:0,calls:[],scrollIntoView(options){this.calls.push(options);}};
  const main={scrollIntoView(){throw new Error('Hero container must not be used');}};
  const prepended=[];
  const context={location:{pathname:'/you.html',search,hash},document:{querySelector(selector){return selector==='[data-direct-content]'?target:selector==='main'?main:null;},createElement(){return {};},body:{prepend(item){prepended.push(item);}}},window:{momentumPageReady:Promise.resolve(),MomentumPreferences:{get(){return 'direct';}}}};
  vm.createContext(context);vm.runInContext(read('momentum-surface.js'),context);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(target.calls.length,expected);assert.equal(prepended[0].href,'#useful');assert.equal(target.tabIndex,-1);
 }
});
