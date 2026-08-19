import { IDENTITIES } from './policy.js';

export const IDENTITY_LOGO_FILES = Object.freeze({
  "white_house": "Seal of the President of the United States.svg",
  "eop": "Seal of the Executive Office of the President of the United States 2014.svg",
  "ovp": "Seal of the Vice President of the United States.svg",
  "whmo": "White House Military Office seal.jpeg",
  "doj": "Seal of the United States Department of Justice.svg",
  "fbi": "Seal of the Federal Bureau of Investigation.svg",
  "usms": "Seal of the United States Marshals Service.svg",
  "mpd": "Seal of the Metropolitan Police Department of the District of Columbia.svg",
  "dhs": "Seal of the United States Department of Homeland Security.svg",
  "usss": "Logo of the United States Secret Service.svg",
  "fps": "Seal of the U.S. Department of Homeland Security Federal Protective Service.png",
  "hsi": "Badge of a U.S. Homeland Security Investigations special agent.svg",
  "dhs_oig": "DHS OIG seal.png",
  "dcfems": "Seal of the District of Columbia Fire and EMS Department.png",
  "uscg": "Seal of the United States Coast Guard.svg",
  "dos": "Seal of the United States Department of State.svg",
  "dss": "Seal of the United States Diplomatic Security Service.svg",
  "dod": "Seal of the United States Department of Defense.svg",
  "us_military": "Joint Chiefs of Staff seal (2).svg",
  "dcng": "JFHQ-DC National Guard Emblem.png",
  "army": "Seal of the US Department of the Army.svg",
  "navy": "Seal of the United States Department of the Navy.svg",
  "air_force": "Seal of the United States Department of the Air Force.svg",
  "marine_corps": "Seal of the United States Marine Corps.svg",
  "socom": "United States Special Operations Command Insignia.svg",
  "dia": "US-DefenseIntelligenceAgency-Seal.svg",
  "nsa": "National Security Agency.svg",
  "pfpa": "Seal of the Pentagon Force Protection Agency.png",
  "dcis": "DCIS LOGO old.jpg",
  "dod_oig": "Seal of DOD OIG.svg",
  "odni": "Seal of the Office of the Director of National Intelligence.svg",
  "cia": "Seal of the Central Intelligence Agency.svg",
  "house": "Seal of the United States House of Representatives.svg",
  "senate": "Seal of the United States Senate.svg",
  "uscp": "Emblem of the United States Capitol Police.svg",
  "uscp_oig": "Emblem of the United States Capitol Police.svg",
  "judiciary": "US-Courts-AdministrativeOffice-Seal.svg",
  "supreme_court": "Seal of the United States Supreme Court.svg",
  "fec": "Seal of the United States Federal Election Commission.svg",
  "nara": "Seal of the United States National Archives and Records Administration.svg"
});

export function identityLogoUrl(id) {
  const filename = IDENTITY_LOGO_FILES[String(id || '')];
  return filename
    ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=512`
    : '';
}

// Production bootstrap: publicIdentity() reads avatarUrl from these same
// identity objects, so the server and publish layer cannot accept a browser-
// supplied webhook avatar. This preload runs before server.js.
for (const identity of IDENTITIES) {
  const url = identityLogoUrl(identity.id);
  if (url) identity.avatarUrl = url;
}
