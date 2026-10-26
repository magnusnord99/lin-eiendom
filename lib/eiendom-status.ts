export type EiendomStatus =
  | "vurderes"
  | "kjopt"
  | "planlegging"
  | "under_oppussing"
  | "klar_for_utleie"
  | "utleid"
  | "til_salgs"
  | "solgt";

export const ALLE_STATUSER: EiendomStatus[] = [
  "vurderes",
  "kjopt",
  "planlegging",
  "under_oppussing",
  "klar_for_utleie",
  "utleid",
  "til_salgs",
  "solgt",
];

export function erGyldigStatus(status: unknown): status is EiendomStatus {
  return typeof status === "string" && (ALLE_STATUSER as string[]).includes(status);
}

export const OFFENTLIG_SYNLIGE_STATUSER: EiendomStatus[] = ["til_salgs", "klar_for_utleie"];

export function erOffentligSynlig(status: string): boolean {
  return (OFFENTLIG_SYNLIGE_STATUSER as string[]).includes(status);
}

export function utledStatusFraAktiv(aktiv: boolean, type: string): EiendomStatus {
  if (aktiv && type === "leie") return "klar_for_utleie";
  if (aktiv) return "til_salgs";
  if (type === "leie") return "utleid";
  return "solgt";
}

export const STATUSER_FOR_TYPE: Record<"salg" | "leie", EiendomStatus[]> = {
  salg: ["vurderes", "kjopt", "planlegging", "under_oppussing", "til_salgs", "solgt"],
  leie: ["vurderes", "kjopt", "planlegging", "under_oppussing", "klar_for_utleie", "utleid"],
};

export function erStatusGyldigForType(status: string, type: string): boolean {
  const statuser = STATUSER_FOR_TYPE[type as "salg" | "leie"];
  if (!statuser) return false;
  return (statuser as string[]).includes(status);
}

export const STATUS_LABELS: Record<EiendomStatus, string> = {
  vurderes: "Vurderes",
  kjopt: "Kjøpt",
  planlegging: "Planlegging",
  under_oppussing: "Under oppussing",
  klar_for_utleie: "Klar for utleie",
  utleid: "Utleid",
  til_salgs: "Til salgs",
  solgt: "Solgt",
};
