"use strict";
const profile = JSON.parse(localStorage.getItem("fitnessAndroid.state") || "{}").profile || null;
const PROGRAM=profile?.program, NEWCODES=profile?.newCodes||[], TECH=profile?.tech||{}, SVG=profile?.svg||{}, TIPS=profile?.tips||[];
function restFor(code){return profile?.rest?.[code] ?? 90}
function ladderFor(code){return profile?.ladders?.[code] || null}
function validateProfile(p){
  if(!Array.isArray(p.program?.days)||!p.program.days.length||!Array.isArray(p.tips)||!p.tips.length||!Array.isArray(p.newCodes))throw new Error("Формат программы");
  for(const d of p.program.days){if(typeof d.id!=="string"||!Array.isArray(d.items)||!d.items.every(i=>typeof i.code==="string"&&Number.isInteger(i.sets)&&i.sets>=1&&i.sets<=8))throw new Error("Формат дня");}
}