/**
 * АВТОГЕНЕРАЦИЯ — не редактировать вручную.
 * Пересборка: npx tsx scripts/build-compound-grade-map.mts
 * Источники: Kimyo 7–9, schoolInorganicManifest, правила ФГОС.
 * Статистика: 7 кл.=109, 8 кл.=296, 9 кл.=405, всего=413
 */
import type { InorganicSchoolGrade } from './compoundGradeIndex'

export type InorganicChapter =
  | 'вода'
  | 'оксиды'
  | 'кислоты'
  | 'основания'
  | 'соли'
  | 'металлы'
  | 'неметаллы'
  | 'кислород'
  | 'водород'
  | 'качественные'
  | 'азот'
  | 'сера'
  | 'фосфор'
  | 'хром'
  | 'хлор'
  | 'марганец'
  | 'кремний'
  | 'катализ'
  | 'прочее'

export type CompoundGradeEntry = {
  grades: readonly InorganicSchoolGrade[]
  chapter: InorganicChapter
}

export const COMPOUND_GRADE_MAP: Readonly<Record<string, CompoundGradeEntry>> = {
  "h2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "вода"
  },
  "co2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "nacl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "co": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "so2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "so3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "no": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "no2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "n2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "азот"
  },
  "n2o5": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "p2o5": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "фосфор"
  },
  "sio2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кремний"
  },
  "li2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "na2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "k2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "mgo": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "cao": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "bao": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "sro": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "al2o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "feo": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "fe2o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "fe3o4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "cuo": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "cu2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "zno": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "ago": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "pbo": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "pbo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "mno2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "катализ"
  },
  "cr2o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром"
  },
  "cro3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром"
  },
  "sno2": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "h2o2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислород"
  },
  "li2o2": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "na2o2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "clo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор"
  },
  "hcl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hbr": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hi": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hf": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "fes2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "сера"
  },
  "h2s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "h2so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "h2so3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hno3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hno2": {
    "grades": [
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "h3po4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "h3po3": {
    "grades": [
      9
    ],
    "chapter": "кислоты"
  },
  "h2co3": {
    "grades": [
      7,
      8
    ],
    "chapter": "кислоты"
  },
  "h2sio3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кремний"
  },
  "hclo4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hclo3": {
    "grades": [
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "hclo": {
    "grades": [
      7,
      8
    ],
    "chapter": "кислоты"
  },
  "hmno4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "марганец"
  },
  "h2cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "naoh": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "koh": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "lioh": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "csoh": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "ba_oh_2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "ca_oh_2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "sr_oh_2": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "mg_oh_2": {
    "grades": [
      7,
      8
    ],
    "chapter": "основания"
  },
  "cu_oh_2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "fe_oh_2": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "fe_oh_3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "al_oh_3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "zn_oh_2": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "nh3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "азот"
  },
  "nh3_h2o": {
    "grades": [
      9
    ],
    "chapter": "азот"
  },
  "salt_na_br": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_f": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_na_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_na_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_na_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_so3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_na_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_na_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_k_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_br": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_k_i": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_f": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_no2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_mno4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_clo3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_k_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_li_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_br": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_f": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_li_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_li_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_li_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_li_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_li_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_nh4_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_nh4_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_nh4_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_nh4_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ag_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ag_clo3": {
    "grades": [
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_clo4": {
    "grades": [
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ag_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ag_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cs_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_br": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_i": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_f": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cs_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_so3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_co3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_sio3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cs_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mg_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mg_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mg_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mg_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ca_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ca_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ca_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ba_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ba_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ba_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_br": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ba_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ba_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sr_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sr_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sr_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_sr_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_zn_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_zn_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_zn_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cu_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cu_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cu_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe2_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe2_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe2_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_fe2_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_so4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_pb_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_pb_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_no3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_pb_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sn_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sn_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_sn_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_sn_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mn_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mn_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_mn_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ni_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ni_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_ni_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_ni_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cobalt_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cobalt_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cobalt_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cobalt_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_al_po4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_br": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_i": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_al_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_al_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_al_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_al_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe3_po4": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe3_clo3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_clo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_so4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe3_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_po4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_br": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_i": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_f": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_no2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_mno4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_clo3": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_clo4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_so3": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_co3": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_s": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_sio3": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_cro4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_nh4_3_po4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_nahco3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_khco3": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_ca_hco3_2": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_k2cr2o7": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  }
} as const
