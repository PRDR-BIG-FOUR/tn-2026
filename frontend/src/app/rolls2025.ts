import rawRolls from "../../../data/ac_2025.json";

export interface Roll2025 {
  ac_no: number;
  ac_name: string;
  district: string;
  reservation: string | null;
  male: number;
  female: number;
  third_gender: number;
  total: number;
}

interface Ac2025Raw {
  sl_no: number;
  ac_no: number;
  ac_name: string;
  reservation: string | null;
  male: number;
  female: number;
  third_gender: number;
  total: number;
}
interface District2025Raw { district_no: number; district_name: string; acs: Ac2025Raw[] }
interface Rolls2025File {
  as_of: string;
  districts: District2025Raw[];
  grand_total: { male: number; female: number; third_gender: number; total: number };
}

const typedRolls = rawRolls as unknown as Rolls2025File;

const allRolls2025: Roll2025[] = typedRolls.districts.flatMap((d) =>
  d.acs.map((a) => ({
    ac_no: a.ac_no,
    ac_name: a.ac_name,
    district: d.district_name,
    reservation: a.reservation,
    male: a.male,
    female: a.female,
    third_gender: a.third_gender,
    total: a.total,
  })),
);

export const rolls2025ByAcNo: Map<number, Roll2025> = new Map(
  allRolls2025.map((r) => [r.ac_no, r]),
);

export const rolls2025AsOf: string = typedRolls.as_of;

export const stateTotal2025: number = typedRolls.grand_total.total;
export const stateMen2025: number = typedRolls.grand_total.male;
export const stateWomen2025: number = typedRolls.grand_total.female;
