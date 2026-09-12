import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=name=>readFile(new URL('../../js/'+name,import.meta.url),'utf8');

test('HOME: both add entry points reach the actual form for today, unrelated clicks do not',async()=>{
 const listeners=[],calls=[];
 const context={document:{addEventListener(name,callback){if(name==='click')listeners.push(callback);}},$:()=>null,iso:()=> '2026-09-12',openActivityDialog:(...args)=>calls.push(args)};
 vm.createContext(context);vm.runInContext(await source('home.js'),context);context.bindHome();
 for(const target of ['hero','today','unrelated'])for(const handler of listeners)handler({target:{closest:selector=>selector==='[data-add-moment]'&&target!=='unrelated'?{}:null}});
 assert.deepEqual(calls,[['2026-09-12',true],['2026-09-12',true]]);
});

test('HOME: an active open intention needs no target date, paused intentions stay out of the Hero',async()=>{
 let profile={open_intention:'Marcher sans échéance'};
 const context={getCurrentUser:async()=>({id:'fake'}),window:{momentumDB:{from(table){const query={select(){return query;},eq(){return query;},order(){return query;},limit(){return query;},async maybeSingle(){return {data:table==='passports'?{personalization:profile}:null,error:null};}};return query;}}}};
 vm.createContext(context);vm.runInContext(await source('home-hero.js'),context);
 const result=await context.loadActiveHorizon();assert.equal(result.title,profile.open_intention);
 assert.deepEqual(Array.from(context.getHeroDetails(result),detail=>detail.label),['Intention ouverte']);
 assert.equal('target_date' in result,false);
 for(const status of ['paused','archived']){profile={...profile,open_intention_status:status};assert.equal(await context.loadActiveHorizon(),null);}
});

test('HOME: missing coordinates never become a GPS position or a weather location at zero',async()=>{
 const context={state:{profile:{locationName:'Ville fictive',latitude:null,longitude:null}},window:{}};vm.createContext(context);vm.runInContext(await source('home-data.js'),context);
 for(const value of [null,undefined,'',' ',false,[],999,'invalid']){
  assert.equal(context.hasLocationCoordinates({latitude:value,longitude:value}),false);
  assert.equal(context.routeLocationPoint({center:{latitude:value,longitude:value}}),null);
 }
 assert.equal(context.getDefaultUserLocation(),null);
 assert.equal(context.hasLocationCoordinates({latitude:0,longitude:0}),true,'real zero coordinates remain valid');
 assert.equal(context.routeLocationPoint({map_points:[[46.5,6.6]]}).latitude,46.5);
});
