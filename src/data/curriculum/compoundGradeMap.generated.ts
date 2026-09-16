/**
 * АВТОГЕНЕРАЦИЯ — не редактировать вручную.
 * Пересборка: npx tsx scripts/build-compound-grade-map.mts
 * Источники: Kimyo 7–9, schoolInorganicManifest, правила ФГОС.
 * Статистика: 7 кл.=175, 8 кл.=318, 9 кл.=350, всего=478
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
      8
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
      8,
      9
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
      8
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
      7
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
      8,
      9
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
      8,
      9
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
  "mg_oh_2": {
    "grades": [
      7,
      8,
      9
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
      7,
      8,
      9
    ],
    "chapter": "азот"
  },
  "salt_na_br": {
    "grades": [
      8
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
  "salt_na_clo2": {
    "grades": [
      8
    ],
    "chapter": "хлор"
  },
  "salt_na_clo3": {
    "grades": [
      8
    ],
    "chapter": "хлор"
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
      7
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
    "chapter": "хлор"
  },
  "salt_k_clo4": {
    "grades": [
      9
    ],
    "chapter": "хлор"
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
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k_sio3": {
    "grades": [
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
  "salt_li_f": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_li_no3": {
    "grades": [
      7
    ],
    "chapter": "соли"
  },
  "salt_li_so4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_li_co3": {
    "grades": [
      7
    ],
    "chapter": "соли"
  },
  "salt_li_s": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_nh4_cl": {
    "grades": [
      7,
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
  "salt_nh4_so4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_nh4_co3": {
    "grades": [
      8
    ],
    "chapter": "соли"
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
  "salt_ag_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "качественные"
  },
  "salt_ag_s": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_cl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_cs_f": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_cs_so4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_mg_so4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_co3": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_s": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_mg_sio3": {
    "grades": [
      9
    ],
    "chapter": "соли"
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
      8
    ],
    "chapter": "соли"
  },
  "salt_mg_no3": {
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
      8
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
  "salt_ca_cl": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_i": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_ca_f": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_ca_no3": {
    "grades": [
      7,
      8,
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
  "salt_ba_co3": {
    "grades": [
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
      7
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
    "chapter": "марганец"
  },
  "salt_ba_clo3": {
    "grades": [
      9
    ],
    "chapter": "хлор"
  },
  "salt_zn_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_zn_co3": {
    "grades": [
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
  "salt_zn_no3": {
    "grades": [
      7,
      8,
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
  "salt_cu_s": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
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
  "salt_cu_no3": {
    "grades": [
      8,
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
  "salt_fe2_co3": {
    "grades": [
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
  "salt_fe2_cl": {
    "grades": [
      7,
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
  "salt_pb_so4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_pb_co3": {
    "grades": [
      7
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
  "salt_pb_cl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_pb_br": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_pb_i": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "salt_pb_no3": {
    "grades": [
      8,
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
  "salt_mn_s": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_cl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_mn_no3": {
    "grades": [
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
  "salt_ni_no3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "salt_al_po4": {
    "grades": [
      8
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
      7
    ],
    "chapter": "соли"
  },
  "salt_al_i": {
    "grades": [
      7
    ],
    "chapter": "соли"
  },
  "salt_al_f": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_no3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_al_so4": {
    "grades": [
      7,
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
  "salt_al_cr2o7": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_fe3_po4": {
    "grades": [
      7
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
  "salt_fe3_no3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_so4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_fe3_co3": {
    "grades": [
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
  "salt_cr_cl": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_cr_no3": {
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
  "salt_cr_s": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "salt_nh4_3_po4": {
    "grades": [
      8
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
      9
    ],
    "chapter": "соли"
  },
  "salt_ca_hco3_2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "salt_k2cr2o7": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_s8": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_p4": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_i2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_br2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_cl2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_f2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_n2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_o2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_h2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_ca3po42": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ph3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_sih4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_cah2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_cac2": {
    "grades": [
      7,
      9
    ],
    "chapter": "прочее"
  },
  "tb_cuso4_5h2o": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cl2o7": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "tb_nah": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_nahso4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_na3po4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cs2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_cuoh2co3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_mn2o7": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_n2o3": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "tb_hgo": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_k2mno4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "марганец"
  },
  "tb_k2o2": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_kh": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_aucl3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ccl4": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_kcl_nacl": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_kcl_mgcl2_6h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_hpo3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "кислоты"
  },
  "tb_cro": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром"
  },
  "tb_cah2po42": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_kclo": {
    "grades": [
      8
    ],
    "chapter": "хлор"
  },
  "tb_ca5po43f": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_nh42hpo4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_nh4h2po4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_caco3_mgco3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_al4c3": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_na2co3_10h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_al2o3_2sio2_2h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_k2o_al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_mn3o4": {
    "grades": [
      7,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_kcl_mgso4_3h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_caso4_2h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_feso4_7h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_na2so4_10h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_becl2": {
    "grades": [
      7,
      8
    ],
    "chapter": "соли"
  },
  "tb_h2se": {
    "grades": [
      7,
      8
    ],
    "chapter": "кислоты"
  },
  "tb_mno": {
    "grades": [
      7,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_mn2o3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_bao2": {
    "grades": [
      7,
      8
    ],
    "chapter": "прочее"
  },
  "tb_ko2": {
    "grades": [
      7,
      9
    ],
    "chapter": "прочее"
  },
  "tb_v2o5": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "tb_naalo2": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "tb_naaloh4": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "tb_ag3po4": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_beo": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "tb_croh3": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "хром"
  },
  "tb_croh2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хром"
  },
  "tb_cs2o": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_pcl3": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_cu2s": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ca3p2": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_mg2si": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_sic": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_hcn": {
    "grades": [
      9
    ],
    "chapter": "кислоты"
  },
  "tb_na3alf6": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_as2s3": {
    "grades": [
      7
    ],
    "chapter": "прочее"
  },
  "tb_na2b4o7_10h2o": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "tb_cl2o5": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_sb2o3": {
    "grades": [
      7,
      8
    ],
    "chapter": "оксиды"
  },
  "tb_wo3": {
    "grades": [
      7,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_mgh2": {
    "grades": [
      7,
      9
    ],
    "chapter": "прочее"
  },
  "tb_na2znoh4": {
    "grades": [
      7,
      9
    ],
    "chapter": "соли"
  },
  "tb_h2cr2o7": {
    "grades": [
      7,
      9
    ],
    "chapter": "хром"
  },
  "tb_h4sio4": {
    "grades": [
      7
    ],
    "chapter": "кислоты"
  },
  "tb_h4p2o7": {
    "grades": [
      7,
      8
    ],
    "chapter": "кислоты"
  },
  "tb_tio2": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_as2o5": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_na2zno2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_rb2o": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_rboh": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_pcl5": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_xef4": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_sbcl3": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_mg3po42": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cucl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_hclo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор"
  },
  "tb_sif4": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_mg3n2": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_n2o4": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_cahpo4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_k3po4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cah2po42_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_cah2po42_2h2o_caso4_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_cn2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_cf4": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_cocl2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_sibr4": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_sis2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_sicl4": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_kcn": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cdso4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_hgno32": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_crcl2": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_mnoh2": {
    "grades": [
      9
    ],
    "chapter": "основания"
  },
  "tb_k3fecn6": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_k4fecn6": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cunh34oh2": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_ba3po42": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_haucl4": {
    "grades": [
      7,
      9
    ],
    "chapter": "кислоты"
  },
  "tb_caclo2": {
    "grades": [
      8,
      9
    ],
    "chapter": "хлор"
  },
  "tb_mgso4_7h2o": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_kncs": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_fencs3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_si3n4": {
    "grades": [
      7
    ],
    "chapter": "прочее"
  },
  "tb_tic": {
    "grades": [
      7
    ],
    "chapter": "прочее"
  },
  "tb_au2o3": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_cl2o3": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_ticl4": {
    "grades": [
      7
    ],
    "chapter": "соли"
  },
  "tb_pb3o4": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_agoh": {
    "grades": [
      7
    ],
    "chapter": "основания"
  },
  "tb_h2b4o7": {
    "grades": [
      7
    ],
    "chapter": "кислоты"
  },
  "tb_h4v2o7": {
    "grades": [
      7
    ],
    "chapter": "кислоты"
  },
  "tb_nio": {
    "grades": [
      7
    ],
    "chapter": "оксиды"
  },
  "tb_h2so4_h2o": {
    "grades": [
      7
    ],
    "chapter": "кислоты"
  },
  "tb_naoh_h2o": {
    "grades": [
      7
    ],
    "chapter": "основания"
  },
  "tb_bh3": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_rbh": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_sno": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_aloh2cl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_caohcl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_kalso42": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_khso4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_mgohno3": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_nh4also42": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_beoh2": {
    "grades": [
      8
    ],
    "chapter": "основания"
  },
  "tb_na2beo2": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_rb2so4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_rbcl": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_i2o7": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_halo2": {
    "grades": [
      8
    ],
    "chapter": "кислоты"
  },
  "tb_b2o3": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_ash3": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_gecl4": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_geo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_clf3": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_xeo4": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_lih": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_mgcl2_6h2o": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_pboh2": {
    "grades": [
      8
    ],
    "chapter": "основания"
  },
  "tb_hgcl2": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_naclo": {
    "grades": [
      8
    ],
    "chapter": "хлор"
  },
  "tb_kio3": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_naio3": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_xef2": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_h2te": {
    "grades": [
      8
    ],
    "chapter": "кислоты"
  },
  "tb_na2se": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_na2te": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_seo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_seo3": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_teo2": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_teo3": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_cahso32": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_scl2": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_sf6": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_li3n": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_nh4hso4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_ptcl4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_cacn2": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_p2s3": {
    "grades": [
      8
    ],
    "chapter": "прочее"
  },
  "tb_p4o10": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_na2hpo4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_nah2po4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_ca5po43oh": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_nanh4hpo4": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_napo3": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_cahpo4_2h2o": {
    "grades": [
      8
    ],
    "chapter": "соли"
  },
  "tb_feohcl2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_feoh2cl": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_sboh2cl": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_sbocl": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_k2sif6": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_sii4": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_na2o_cao_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_coo": {
    "grades": [
      9
    ],
    "chapter": "оксиды"
  },
  "tb_feh2po42": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_fehpo4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_fe3po42": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_ptno32": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_na2o_al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_nanh2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_nh4hco3": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cao_3mgo_4sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_caso4_h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_ca3n2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_mgo_cao": {
    "grades": [
      9
    ],
    "chapter": "оксиды"
  },
  "tb_caso42_h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_mghco32": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_na2o_al2o3_2sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_k2o_2h2o_3al2o3_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_alh3": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_aln": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_alp": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_al2so43_18h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_kalo2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_kalso42_12h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cufes2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cucl2_2h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cuno32_3h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_kaucn2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_k2zncn4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cds": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_hgs": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_k2znoh4": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cdoh2": {
    "grades": [
      9
    ],
    "chapter": "основания"
  },
  "tb_hgoh2": {
    "grades": [
      9
    ],
    "chapter": "основания"
  },
  "tb_znso4_7h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_hg2o": {
    "grades": [
      9
    ],
    "chapter": "оксиды"
  },
  "tb_feo_cr2o3": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_crn": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_nacro2": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_na3croh6": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_k2so4_cr2so43_12h2o": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_nh42so4_cr2so43_6h2o": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_crso4": {
    "grades": [
      9
    ],
    "chapter": "хром"
  },
  "tb_mn3n2": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_mnso4_4h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_h2mno4": {
    "grades": [
      9
    ],
    "chapter": "марганец"
  },
  "tb_fen": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_fe2so43_9h2o": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_al2o3_3beo_6sio2": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cu2c2": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_hgso4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cuoh": {
    "grades": [
      7,
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_n2h4": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_nh2oh": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_agnh32oh": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_al4p2o73": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_sr3po42": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_bino33": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_nioh2": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_nacn": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_na2s2o3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_nocl": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_h3aso4": {
    "grades": [
      9
    ],
    "chapter": "кислоты"
  },
  "tb_na2c2o4": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_cdno32": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_caocl2": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_of2": {
    "grades": [
      7,
      8
    ],
    "chapter": "прочее"
  },
  "tb_ko3": {
    "grades": [
      7
    ],
    "chapter": "прочее"
  },
  "tb_br2o7": {
    "grades": [
      8
    ],
    "chapter": "оксиды"
  },
  "tb_feco5": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_fe3c": {
    "grades": [
      9
    ],
    "chapter": "прочее"
  },
  "tb_kfefecn6": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_fe3fecn62": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_fe4fecn63": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_scoh3": {
    "grades": [
      8,
      9
    ],
    "chapter": "основания"
  },
  "tb_sc2o3": {
    "grades": [
      8,
      9
    ],
    "chapter": "оксиды"
  },
  "tb_p4s7": {
    "grades": [
      8,
      9
    ],
    "chapter": "прочее"
  },
  "tb_ch3coona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c2h5ona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c6h5ona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c17h35coona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ch3coo2ca": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c2h5coona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ch3ch2ch2coona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ch3coo2mg": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_ch3cook": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_nh4ncs": {
    "grades": [
      9
    ],
    "chapter": "соли"
  },
  "tb_cu3co32oh2": {
    "grades": [
      7
    ],
    "chapter": "соли"
  },
  "tb_hcoona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_naoch2ch2ona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c3h5ona3": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_feoc6h53": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c6h5so3na": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c6h5ok": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  },
  "tb_c15h31coona": {
    "grades": [
      8,
      9
    ],
    "chapter": "соли"
  }
} as const
