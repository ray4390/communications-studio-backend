import { CHANNEL_ACCESS_ROLES, routingPolicy } from './routing.js';

const R = (groupId, roles) => ({ type: 'roblox', groupId: String(groupId), roles });
const D = (roles) => ({ type: 'discord', roles: roles.map(String) });

export const FEC_DISCORD_ROLES = Object.freeze(['1459393135175270593', '1031740186750636042']);
export const NARA_DISCORD_ROLES = Object.freeze(['1089923208079220797']);

export const IDENTITIES = Object.freeze([
  { id:'white_house', category:'White House', label:'The White House', displayName:'The White House', initials:'WH', color:'#16365d', access:R(6121205, ['White House Press Office','White House Communications Office','Executive Office of the President','Deputy Chief of Staff','Principal Deputy Chief of Staff','White House Chief of Staff','Vice President','President']) },
  { id:'eop', category:'White House', label:'Executive Office of the President', displayName:'Executive Office of the President', initials:'EOP', color:'#16365d', access:R(12291969, ['White House Chief of Staff','Vice President','President']) },
  { id:'ovp', category:'White House', label:'Office of the Vice President', displayName:'Office of the Vice President', initials:'OVP', color:'#244b70', access:R(12711997, ['Office of Communications',"Deputy Vice President's Chief of Staff","Vice President's Chief of Staff",'Vice President']) },
  { id:'whmo', category:'White House', label:'White House Military Office', displayName:'White House Military Office', initials:'WHMO', color:'#384552', access:R(16903930, ['White House Military Office Staff','Chief of Staff','Deputy Director','Director']) },

  { id:'doj', category:'Department of Justice', label:'Department of Justice', displayName:'United States Department of Justice', initials:'DOJ', color:'#1f4d3e', access:R(6071470, ['Office of the Attorney General','Chief of Staff','Associate Attorney General','Deputy Attorney General','Attorney General']) },
  { id:'fbi', category:'Department of Justice', label:'Federal Bureau of Investigation', displayName:'Federal Bureau of Investigation', initials:'FBI', color:'#294b63', access:R(6057701, ['Executive Assistant Director','Associate Deputy Director','Chief of Staff','Deputy Director','Director']) },
  { id:'usms', category:'Department of Justice', label:'United States Marshals Service', displayName:'United States Marshals Service', initials:'USMS', color:'#4a3b26', access:R(6435281, ['Executive Staff','Chief of Staff','Deputy Director','Director']) },
  { id:'mpd', category:'Department of Justice', label:'Metropolitan Police Department', displayName:'Metropolitan Police Department', initials:'MPD', color:'#324a67', access:R(6150285, ['Administrative Office','Assistant Chief of Police','Executive Assistant Chief of Police','Chief of Police']) },

  { id:'dhs', category:'Department of Homeland Security', label:'Department of Homeland Security', displayName:'United States Department of Homeland Security', initials:'DHS', color:'#1d4e5f', access:R(6057710, ['Federal Communications Center','Chief of Staff','Executive Secretary','Deputy Secretary','Secretary']) },
  { id:'usss', category:'Department of Homeland Security', label:'United States Secret Service', displayName:'United States Secret Service', initials:'USSS', color:'#263b50', access:R(6057741, ['Executive Staff','Chief of Staff','Chief Operating Officer','Deputy Director','Director']) },
  { id:'fps', category:'Department of Homeland Security', label:'Federal Protective Service', displayName:'Federal Protective Service', initials:'FPS', color:'#40505c', access:R(6071521, ['Chief of Staff','Deputy Director','Director']) },
  { id:'hsi', category:'Department of Homeland Security', label:'Homeland Security Investigations', displayName:'Homeland Security Investigations', initials:'HSI', color:'#224c58', access:R(34332513, ['Assistant Director','Deputy Executive Associate Director','Executive Associate Director']) },
  { id:'dhs_oig', category:'Department of Homeland Security', label:'DHS Office of Inspector General', displayName:'DHS Office of Inspector General', initials:'OIG', color:'#4a565c', access:R(34160617, ['Chief of Staff','Principal Deputy Inspector General','Inspector General']) },
  { id:'dcfems', category:'Department of Homeland Security', label:'District of Columbia Fire and EMS', displayName:'District of Columbia Fire and EMS', initials:'FEMS', color:'#7a2d2d', access:R(13216655, ['Battalion Chief','Assistant Chief','Deputy Chief','Fire & EMS Chief']) },
  { id:'uscg', category:'Department of Homeland Security', label:'United States Coast Guard', displayName:'United States Coast Guard', initials:'USCG', color:'#234b6e', access:R(13618143, ['Coast Guard Headquarters','Vice Commandant of the Coast Guard','Commandant of the Coast Guard']) },

  { id:'dos', category:'Department of State', label:'Department of State', displayName:'United States Department of State', initials:'DOS', color:'#1a4480', access:R(6121404, ['Chief of Staff to the Secretary','Under Secretary of State','Deputy Secretary of State','Secretary of State']) },
  { id:'dss', category:'Department of State', label:'Diplomatic Security Service', displayName:'Diplomatic Security Service', initials:'DSS', color:'#24476b', access:R(13705890, ['Senior Coordinator for Diplomatic Security','Deputy Director','Director','Assistant Secretary of State for Diplomatic Security']) },

  { id:'dod', category:'Department of Defense', label:'Department of Defense', displayName:'United States Department of Defense', initials:'DOD', color:'#394b35', access:R(6057831, ['Press Secretary','Executive Secretary of Defense','Office of the Secretary of Defense','Deputy Secretary of Defense','Secretary of Defense']) },
  { id:'us_military', category:'Department of Defense', label:'United States Military', displayName:'United States Military', initials:'USM', color:'#41483a', access:R(12924310, ['[JCS]','[VCJCS]','[CJCS]','[DOD]','[DEPSECDEF]','[SECDEF]','[CIC]']) },
  { id:'dcng', category:'Department of Defense', label:'District of Columbia National Guard', displayName:'District of Columbia National Guard', initials:'DCNG', color:'#4a523a', access:R(13150677, ['Joint Force Headquarters','Adjutant General','Commanding General']) },
  { id:'army', category:'Department of Defense', label:'United States Army', displayName:'United States Army', initials:'USA', color:'#2f3b2f', access:R(6120499, ['Army Headquarters','Vice Chief of Staff of the Army','Chief of Staff of the Army','Secretary of the Army']) },
  { id:'navy', category:'Department of Defense', label:'United States Navy', displayName:'United States Navy', initials:'USN', color:'#263d5a', access:R(12906320, ['OPNAV','Vice Chief of Naval Operations','Chief of Naval Operations','Secretary of the Navy']) },
  { id:'air_force', category:'Department of Defense', label:'United States Air Force', displayName:'United States Air Force', initials:'USAF', color:'#315b77', access:R(12906344, ['Air Force Headquarters','Vice Chief of Staff of the Air Force','Chief of Staff of the Air Force','Secretary of the Air Force']) },
  { id:'marine_corps', category:'Department of Defense', label:'United States Marine Corps', displayName:'United States Marine Corps', initials:'USMC', color:'#6a3030', access:R(8398256, ['Marine Corps Headquarters','Assistant Commandant of the Marine Corps','Commandant of the Marine Corps','Secretary of the Navy']) },
  { id:'socom', category:'Department of Defense', label:'United States Special Operations Command', displayName:'United States Special Operations Command', initials:'SOCOM', color:'#3c4435', access:R(33645084, ['Command Staff','Vice Commander','Deputy Commander','Commander']) },
  { id:'dia', category:'Department of Defense', label:'Defense Intelligence Agency', displayName:'Defense Intelligence Agency', initials:'DIA', color:'#374756', access:R(6606946, ['Chief of Staff','Deputy Director','Director']) },
  { id:'nsa', category:'Department of Defense', label:'National Security Agency', displayName:'National Security Agency', initials:'NSA', color:'#384a55', access:R(6150413, ['Chief of Staff','Deputy Director','Director']) },
  { id:'pfpa', category:'Department of Defense', label:'Pentagon Force Protection Agency', displayName:'Pentagon Force Protection Agency', initials:'PFPA', color:'#435052', access:R(34660545, ['Executive Director','Deputy Director','Director']) },
  { id:'dcis', category:'Department of Defense', label:'Defense Criminal Investigative Service', displayName:'Defense Criminal Investigative Service', initials:'DCIS', color:'#3e4c55', access:R(13770277, ['Assistant Director','Deputy Director','Director']) },
  { id:'dod_oig', category:'Department of Defense', label:'Department of Defense Office of Inspector General', displayName:'Department of Defense Office of Inspector General', initials:'OIG', color:'#4c5051', access:R(16141692, ['Chief of Staff','Deputy Inspector General','Inspector General']) },

  { id:'odni', category:'Intelligence Community', label:'Office of the Director of National Intelligence', displayName:'Office of the Director of National Intelligence', initials:'ODNI', color:'#343e53', access:R(6150704, ['Press Secretary','Deputy Director of National Intelligence','Director of Intelligence Staff','Principal Deputy Director of National Intelligence','Director of National Intelligence']) },
  { id:'cia', category:'Intelligence Community', label:'Central Intelligence Agency', displayName:'Central Intelligence Agency', initials:'CIA', color:'#414141', access:R(6150156, ['Chief of Staff','Associate Deputy Director','Deputy Director','Director']) },

  { id:'house', category:'Congress', label:'United States House of Representatives', displayName:'United States House of Representatives', initials:'HOUSE', color:'#274c77', access:R(6057804, ['Minority Leader','Majority Leader','Sergeant at Arms of the House','Clerk of the House','Speaker Pro Tempore','Speaker of the House']) },
  { id:'senate', category:'Congress', label:'United States Senate', displayName:'United States Senate', initials:'SEN', color:'#315b45', access:R(6057814, ['Sergeant at Arms of the Senate','Minority Leader','Secretary of the Senate','Majority Leader','President Pro Tempore of the Senate','President of the Senate']) },
  { id:'uscp', category:'Congress', label:'United States Capitol Police', displayName:'United States Capitol Police', initials:'USCP', color:'#24455f', access:R(13216797, ['Office of the Chief','Deputy Chief of Police','Assistant Chief of Police','Chief of Police','Capitol Police Board']) },
  { id:'uscp_oig', category:'Congress', label:'United States Capitol Police — Office of Inspector General', displayName:'United States Capitol Police Office of Inspector General', initials:'OIG', color:'#35495b', access:R(13216797, ['Inspector General']) },

  { id:'judiciary', category:'Judiciary', label:'United States Courts / Federal Judiciary', displayName:'United States Courts', initials:'USC', color:'#3b4f63', access:R(6071495, ['Court Clerk','Chief Judge','Chief Justice']) },
  { id:'supreme_court', category:'Judiciary', label:'Supreme Court of the United States', displayName:'Supreme Court of the United States', initials:'SCOTUS', color:'#4d443a', access:R(6071495, ['Clerks of the Supreme Court','Associate Justices of the Supreme Court','Chief Justice']) },
  { id:'ulpa', category:'Judiciary', label:'Uniform Legal Practice Authority', displayName:'Uniform Legal Practice Authority', initials:'ULPA', color:'#12365a', access:D([CHANNEL_ACCESS_ROLES.judicial]) },

  { id:'fec', category:'Independent', label:'Federal Election Commission', displayName:'Federal Election Commission', initials:'FEC', color:'#344e73', access:D(FEC_DISCORD_ROLES) },
  { id:'nara', category:'Independent', label:'National Archives and Records Administration', displayName:'National Archives and Records Administration', initials:'NARA', color:'#8b1e2d', avatarUrl:'https://raw.githubusercontent.com/nationalarchivesusar/us-code/main/assets/images/nara.png', access:D(NARA_DISCORD_ROLES) }
]);

const BY_ID = new Map(IDENTITIES.map((identity) => [identity.id, identity]));

export function getIdentity(id) {
  return BY_ID.get(id) || null;
}

export function publicIdentity(identity) {
  return {
    id: identity.id,
    category: identity.category,
    label: identity.label,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl || '',
    avatar_initials: identity.initials,
    avatar_color: identity.color
  };
}

function robloxRoleMap(groupRoles = []) {
  const map = new Map();
  for (const membership of groupRoles) {
    const groupId = String(membership?.group?.id ?? membership?.groupId ?? '');
    const roleName = membership?.role?.name ?? membership?.roleName ?? '';
    if (groupId) map.set(groupId, roleName);
  }
  return map;
}

function hasRequiredDiscordChannelAccess(identity, discordRoleIds = []) {
  const discordRoles = new Set((discordRoleIds || []).map(String));
  const requiredRoles = routingPolicy(identity.id).channelKeys
    .map((key) => CHANNEL_ACCESS_ROLES[key])
    .filter(Boolean);
  return requiredRoles.length === 0 || requiredRoles.some((roleId) => discordRoles.has(roleId));
}

export function qualifies(identity, authz = {}) {
  if (!identity?.access) return false;
  if (identity.access.type === 'discord') {
    const roles = new Set((authz.discordRoleIds || []).map(String));
    return identity.access.roles.some((roleId) => roles.has(String(roleId)));
  }
  if (identity.access.type === 'roblox') {
    if (!authz.robloxUserId) return false;
    if (!hasRequiredDiscordChannelAccess(identity, authz.discordRoleIds)) return false;
    const roles = robloxRoleMap(authz.robloxGroupRoles);
    return identity.access.roles.includes(roles.get(String(identity.access.groupId)));
  }
  return false;
}

export function authorizedIdentities(authz = {}) {
  return IDENTITIES.filter((identity) => qualifies(identity, authz)).map(publicIdentity);
}
